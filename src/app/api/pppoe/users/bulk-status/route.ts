import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { disconnectMultiplePPPoEUsers } from '@/lib/services/coaService';

export async function PUT(request: Request) {
  try {
    const { userIds, status } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid userIds' },
        { status: 400 }
      );
    }

    if (!status || !['active', 'isolated', 'blocked'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: active, isolated, or blocked' },
        { status: 400 }
      );
    }

    // Get all users
    const users = await prisma.pppoeUser.findMany({
      where: { id: { in: userIds } },
      include: { profile: true },
    });

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No users found' },
        { status: 404 }
      );
    }

    // Update all users status
    await prisma.pppoeUser.updateMany({
      where: { id: { in: userIds } },
      data: { status },
    });

    // Update RADIUS for each user based on status
    for (const user of users) {
      if (status === 'active') {
        // Restore to original profile
        // 1. Ensure password in radcheck
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
          ON DUPLICATE KEY UPDATE value = ${user.password}
        `;

        // 2. Restore to original group
        await prisma.$executeRaw`
          DELETE FROM radusergroup WHERE username = ${user.username}
        `;
        await prisma.$executeRaw`
          INSERT INTO radusergroup (username, groupname, priority)
          VALUES (${user.username}, ${user.profile.groupName}, 1)
        `;

        // 3. Restore static IP if exists
        if (user.ipAddress) {
          await prisma.$executeRaw`
            INSERT INTO radreply (username, attribute, op, value)
            VALUES (${user.username}, 'Framed-IP-Address', ':=', ${user.ipAddress})
            ON DUPLICATE KEY UPDATE value = ${user.ipAddress}
          `;
        }
      } else if (status === 'isolated') {
        // Move to isolir group - MikroTik will apply isolir profile
        // Remove static IP so user gets IP from MikroTik pool-isolir
        
        // 1. Keep password in radcheck
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
          ON DUPLICATE KEY UPDATE value = ${user.password}
        `;

        // 2. Move to isolir group (this maps to MikroTik profile 'isolir')
        await prisma.$executeRaw`
          DELETE FROM radusergroup WHERE username = ${user.username}
        `;
        await prisma.$executeRaw`
          INSERT INTO radusergroup (username, groupname, priority)
          VALUES (${user.username}, 'isolir', 1)
        `;

        // 3. DELETE Framed-IP so user gets IP from MikroTik pool-isolir
        await prisma.$executeRaw`
          DELETE FROM radreply WHERE username = ${user.username} AND attribute = 'Framed-IP-Address'
        `;
      } else if (status === 'blocked') {
        // Block: Remove from all RADIUS tables
        await prisma.$executeRaw`
          DELETE FROM radcheck WHERE username = ${user.username}
        `;
        await prisma.$executeRaw`
          DELETE FROM radusergroup WHERE username = ${user.username}
        `;
        await prisma.$executeRaw`
          DELETE FROM radreply WHERE username = ${user.username}
        `;
      }
    }

    // Send CoA disconnect to all affected users
    const usernames = users.map(u => u.username);
    const coaResult = await disconnectMultiplePPPoEUsers(usernames);
    console.log(`[Bulk Status Change] CoA disconnect result:`, coaResult);

    return NextResponse.json({
      success: true,
      updated: users.length,
      status,
      coa: coaResult,
    });
  } catch (error) {
    console.error('Bulk status change error:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}
