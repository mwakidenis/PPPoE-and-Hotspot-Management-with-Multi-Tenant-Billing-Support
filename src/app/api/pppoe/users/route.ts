import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendAdminCreateUser } from '@/lib/whatsapp-notifications';

const prisma = new PrismaClient();

// GET - List all PPPoE users
export async function GET() {
  try {
    const users = await prisma.pppoeUser.findMany({
      include: {
        profile: true,
        router: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check online status for each user
    const usersWithOnlineStatus = await Promise.all(
      users.map(async (user) => {
        // Check if user has an active session in radacct
        const activeSession = await prisma.radacct.findFirst({
          where: {
            username: user.username,
            acctstoptime: null, // Session is still active
          },
        });

        return {
          ...user,
          isOnline: !!activeSession,
        };
      })
    );

    return NextResponse.json({
      users: usersWithOnlineStatus,
      count: usersWithOnlineStatus.length,
    });
  } catch (error) {
    console.error('Get PPPoE users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new PPPoE user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      username,
      password,
      profileId,
      routerId,
      name,
      phone,
      email,
      address,
      latitude,
      longitude,
      ipAddress,
      macAddress,
      comment,
      expiredAt,
    } = body;

    // Validate required fields
    if (!username || !password || !profileId || !name || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if username already exists
    const existingUser = await prisma.pppoeUser.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: `Username "${username}" already exists` },
        { status: 400 }
      );
    }

    // Get profile to retrieve groupName
    const profile = await prisma.pppoeProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Calculate expiry date if not provided
    let finalExpiredAt = expiredAt;
    if (!finalExpiredAt) {
      const now = new Date();
      if (profile.validityUnit === 'MONTHS') {
        now.setMonth(now.getMonth() + profile.validityValue);
      } else {
        now.setDate(now.getDate() + profile.validityValue);
      }
      finalExpiredAt = now.toISOString();
    }

    // Verify router if provided
    if (routerId) {
      const router = await prisma.router.findUnique({
        where: { id: routerId },
      });
      if (!router) {
        return NextResponse.json({ error: 'Router not found' }, { status: 404 });
      }
    }

    // Create user
    const user = await prisma.pppoeUser.create({
      data: {
        id: crypto.randomUUID(),
        username,
        password,
        profileId,
        routerId: routerId || null,
        name,
        phone,
        email: email || null,
        address: address || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        ipAddress: ipAddress || null,
        macAddress: macAddress || null,
        comment: comment || null,
        expiredAt: finalExpiredAt ? new Date(finalExpiredAt) : null,
        status: 'active',
      },
    });

    // Sync to FreeRADIUS
    try {
      // 1. Create radcheck entry for password (Cleartext-Password)
      await prisma.radcheck.create({
        data: {
          username,
          attribute: 'Cleartext-Password',
          op: ':=',
          value: password,
        },
      });

      // 2. Create radusergroup entry to assign user to profile group
      await prisma.radusergroup.create({
        data: {
          username,
          groupname: profile.groupName,
          priority: 0,
        },
      });

      // 3. Optional: Add static IP to radreply if specified
      if (ipAddress) {
        await prisma.radreply.create({
          data: {
            username,
            attribute: 'Framed-IP-Address',
            op: ':=',
            value: ipAddress,
          },
        });
      }

      // Mark as synced
      await prisma.pppoeUser.update({
        where: { id: user.id },
        data: {
          syncedToRadius: true,
          lastSyncAt: new Date(),
        },
      });

      // Send WhatsApp notification
      await sendAdminCreateUser({
        customerName: name,
        customerPhone: phone,
        username,
        password,
        profileName: profile.name,
      });
      console.log(`✅ WhatsApp notification sent to ${phone}`);

      return NextResponse.json({
        success: true,
        user: {
          ...user,
          syncedToRadius: true,
        },
      }, { status: 201 });
    } catch (syncError: any) {
      console.error('RADIUS sync error:', syncError);
      return NextResponse.json({
        success: true,
        user,
        warning: 'User created but RADIUS sync failed',
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Create PPPoE user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update PPPoE user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      username,
      password,
      profileId,
      routerId,
      name,
      phone,
      email,
      address,
      latitude,
      longitude,
      ipAddress,
      macAddress,
      comment,
      expiredAt,
      status,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const currentUser = await prisma.pppoeUser.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if username changed and new one already exists
    if (username && username !== currentUser.username) {
      const existingUser = await prisma.pppoeUser.findUnique({
        where: { username },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: `Username "${username}" already exists` },
          { status: 400 }
        );
      }
    }

    // Get new profile if changed
    let newProfile = currentUser.profile;
    if (profileId && profileId !== currentUser.profileId) {
      const profile = await prisma.pppoeProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      newProfile = profile;
    }

    // Verify router if provided
    if (routerId) {
      const router = await prisma.router.findUnique({
        where: { id: routerId },
      });
      if (!router) {
        return NextResponse.json({ error: 'Router not found' }, { status: 404 });
      }
    }

    // Update user
    const user = await prisma.pppoeUser.update({
      where: { id },
      data: {
        ...(username && { username }),
        ...(password && { password }),
        ...(profileId && { profileId }),
        ...(routerId !== undefined && { routerId: routerId || null }),
        ...(name && { name }),
        ...(phone && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(ipAddress !== undefined && { ipAddress }),
        ...(macAddress !== undefined && { macAddress }),
        ...(comment !== undefined && { comment }),
        ...(expiredAt && { expiredAt: new Date(expiredAt) }),
        ...(status && { status }),
      },
    });

    // Re-sync to RADIUS if critical fields changed
    if (username || password || profileId || ipAddress) {
      try {
        const oldUsername = currentUser.username;
        const newUsername = username || currentUser.username;

        // Delete old RADIUS entries
        await prisma.radcheck.deleteMany({
          where: { username: oldUsername },
        });
        await prisma.radreply.deleteMany({
          where: { username: oldUsername },
        });
        await prisma.radusergroup.deleteMany({
          where: { username: oldUsername },
        });

        // Create new RADIUS entries
        await prisma.radcheck.create({
          data: {
            username: newUsername,
            attribute: 'Cleartext-Password',
            op: ':=',
            value: password || currentUser.password,
          },
        });

        await prisma.radusergroup.create({
          data: {
            username: newUsername,
            groupname: newProfile.groupName,
            priority: 0,
          },
        });

        // Add static IP to radreply if specified
        const finalIpAddress = ipAddress !== undefined ? ipAddress : currentUser.ipAddress;
        if (finalIpAddress) {
          await prisma.radreply.create({
            data: {
              username: newUsername,
              attribute: 'Framed-IP-Address',
              op: ':=',
              value: finalIpAddress,
            },
          });
        }

        // Mark as synced
        await prisma.pppoeUser.update({
          where: { id },
          data: {
            syncedToRadius: true,
            lastSyncAt: new Date(),
          },
        });
      } catch (syncError) {
        console.error('RADIUS re-sync error:', syncError);
      }
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Update PPPoE user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove PPPoE user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const user = await prisma.pppoeUser.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete RADIUS entries
    try {
      await prisma.radcheck.deleteMany({
        where: { username: user.username },
      });
      await prisma.radreply.deleteMany({
        where: { username: user.username },
      });
      await prisma.radusergroup.deleteMany({
        where: { username: user.username },
      });
    } catch (syncError) {
      console.error('RADIUS cleanup error:', syncError);
    }

    // Delete user
    await prisma.pppoeUser.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete PPPoE user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
