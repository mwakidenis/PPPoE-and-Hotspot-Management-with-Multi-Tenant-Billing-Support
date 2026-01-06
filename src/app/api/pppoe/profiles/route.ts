import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - List all PPPoE profiles
export async function GET() {
  try {
    const profiles = await prisma.pppoeProfile.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      profiles,
      count: profiles.length,
    });
  } catch (error) {
    console.error('Get PPPoE profiles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new PPPoE profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      groupName,
      price,
      downloadSpeed,
      uploadSpeed,
      validityValue,
      validityUnit,
    } = body;

    // Validate required fields
    if (!name || !groupName || !price || !downloadSpeed || !uploadSpeed || !validityValue || !validityUnit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if groupName already exists
    const existingProfile = await prisma.pppoeProfile.findUnique({
      where: { groupName },
    });

    if (existingProfile) {
      return NextResponse.json(
        { error: `Group name "${groupName}" already exists. Please use a unique group name.` },
        { status: 400 }
      );
    }

    // Create profile
    const profile = await prisma.pppoeProfile.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description: description || null,
        groupName,
        price: parseInt(price),
        downloadSpeed: parseInt(downloadSpeed),
        uploadSpeed: parseInt(uploadSpeed),
        validityValue: parseInt(validityValue),
        validityUnit,
        isActive: true,
      },
    });

    // Sync to FreeRADIUS radgroupreply
    try {
      // Format rate limit: downloadM/uploadM (e.g. "10M/10M")
      const rateLimit = `${downloadSpeed}M/${uploadSpeed}M`;

      // Create Mikrotik-Group attribute (maps to MikroTik PPP profile)
      await prisma.radgroupreply.create({
        data: {
          groupname: groupName,
          attribute: 'Mikrotik-Group',
          op: ':=',
          value: groupName, // Must match PPP profile name in MikroTik
        },
      });

      // Create Mikrotik-Rate-Limit attribute (bandwidth limitation)
      await prisma.radgroupreply.create({
        data: {
          groupname: groupName,
          attribute: 'Mikrotik-Rate-Limit',
          op: ':=',
          value: rateLimit,
        },
      });

      // Mark as synced
      await prisma.pppoeProfile.update({
        where: { id: profile.id },
        data: {
          syncedToRadius: true,
          lastSyncAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        profile: {
          ...profile,
          syncedToRadius: true,
        },
      }, { status: 201 });
    } catch (syncError: any) {
      console.error('RADIUS sync error:', syncError);
      // Profile created but sync failed
      return NextResponse.json({
        success: true,
        profile,
        warning: 'Profile created but RADIUS sync failed',
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Create PPPoE profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update PPPoE profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      description,
      groupName,
      price,
      downloadSpeed,
      uploadSpeed,
      validityValue,
      validityUnit,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const currentProfile = await prisma.pppoeProfile.findUnique({ where: { id } });
    if (!currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if groupName changed and new one already exists
    if (groupName && groupName !== currentProfile.groupName) {
      const existingProfile = await prisma.pppoeProfile.findUnique({
        where: { groupName },
      });

      if (existingProfile) {
        return NextResponse.json(
          { error: `Group name "${groupName}" already exists.` },
          { status: 400 }
        );
      }
    }

    // Update profile
    const profile = await prisma.pppoeProfile.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(groupName && { groupName }),
        ...(price && { price: parseInt(price) }),
        ...(downloadSpeed && { downloadSpeed: parseInt(downloadSpeed) }),
        ...(uploadSpeed && { uploadSpeed: parseInt(uploadSpeed) }),
        ...(validityValue && { validityValue: parseInt(validityValue) }),
        ...(validityUnit && { validityUnit }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Re-sync to RADIUS if groupName or speeds changed
    if (groupName || downloadSpeed || uploadSpeed) {
      try {
        const oldGroupName = currentProfile.groupName;
        const newGroupName = groupName || currentProfile.groupName;
        const newDownload = downloadSpeed || currentProfile.downloadSpeed;
        const newUpload = uploadSpeed || currentProfile.uploadSpeed;
        const rateLimit = `${newDownload}M/${newUpload}M`;

        // Delete old RADIUS entries
        await prisma.radgroupreply.deleteMany({
          where: { groupname: oldGroupName },
        });

        // Create new RADIUS entries
        await prisma.radgroupreply.createMany({
          data: [
            {
              groupname: newGroupName,
              attribute: 'Mikrotik-Group',
              op: ':=',
              value: newGroupName,
            },
            {
              groupname: newGroupName,
              attribute: 'Mikrotik-Rate-Limit',
              op: ':=',
              value: rateLimit,
            },
          ],
        });

        // Mark as synced
        await prisma.pppoeProfile.update({
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

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Update PPPoE profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove PPPoE profile
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const profile = await prisma.pppoeProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if profile is used by any users
    const userCount = await prisma.pppoeUser.count({
      where: { profileId: id },
    });

    if (userCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete profile. ${userCount} user(s) are using this profile.` },
        { status: 400 }
      );
    }

    // Delete RADIUS entries
    try {
      await prisma.radgroupreply.deleteMany({
        where: { groupname: profile.groupName },
      });
    } catch (syncError) {
      console.error('RADIUS cleanup error:', syncError);
    }

    // Delete profile
    await prisma.pppoeProfile.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Profile deleted successfully',
    });
  } catch (error) {
    console.error('Delete PPPoE profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
