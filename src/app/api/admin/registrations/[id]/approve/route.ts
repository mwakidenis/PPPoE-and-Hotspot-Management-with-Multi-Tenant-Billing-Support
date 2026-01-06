import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendRegistrationApproval } from '@/lib/whatsapp-notifications';

// Helper to generate username from name and phone
function generateUsername(name: string, phone: string): string {
  const namePart = name
    .split(' ')[0]
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return `${namePart}-${phone}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { installationFee } = body;

    if (!installationFee || installationFee <= 0) {
      return NextResponse.json(
        { error: 'Installation fee is required' },
        { status: 400 }
      );
    }

    // Get registration
    const registration = await prisma.registrationRequest.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Registration is not pending' },
        { status: 400 }
      );
    }

    // Generate username and password
    const username = generateUsername(registration.name, registration.phone);
    const password = username;

    // Check if username already exists
    const existingUser = await prisma.pppoeUser.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists. Please contact admin.' },
        { status: 400 }
      );
    }

    // Create PPPoE user
    const pppoeUser = await prisma.pppoeUser.create({
      data: {
        id: crypto.randomUUID(),
        username,
        password,
        name: registration.name,
        phone: registration.phone,
        email: registration.email,
        address: registration.address,
        profileId: registration.profileId,
        status: 'active', // Create as active first
        syncedToRadius: false,
      },
    });

    // Sync to RADIUS (radcheck + radusergroup)
    // Password
    await prisma.radcheck.upsert({
      where: {
        username_attribute: {
          username,
          attribute: 'Cleartext-Password',
        },
      },
      create: {
        username,
        attribute: 'Cleartext-Password',
        op: ':=',
        value: password,
      },
      update: {
        value: password,
      },
    });

    // Add to group
    await prisma.radusergroup.upsert({
      where: {
        username_groupname: {
          username,
          groupname: registration.profile.groupName,
        },
      },
      create: {
        username,
        groupname: registration.profile.groupName,
        priority: 1,
      },
      update: {
        groupname: registration.profile.groupName,
      },
    });

    // Mark as synced
    await prisma.pppoeUser.update({
      where: { id: pppoeUser.id },
      data: { syncedToRadius: true },
    });

    // Now set to isolated
    await prisma.pppoeUser.update({
      where: { id: pppoeUser.id },
      data: { status: 'isolated' },
    });

    // Add isolated attribute to RADIUS (limit speed or access)
    // This can be customized based on your RADIUS setup
    await prisma.radreply.create({
      data: {
        username,
        attribute: 'Reply-Message',
        op: ':=',
        value: 'Account pending payment. Please pay installation invoice.',
      },
    });

    // Update registration
    await prisma.registrationRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        installationFee,
        pppoeUserId: pppoeUser.id,
      },
    });

    // Send WhatsApp notification
    await sendRegistrationApproval({
      customerName: registration.name,
      customerPhone: registration.phone,
      username: pppoeUser.username,
      password: pppoeUser.password,
      profileName: registration.profile.name,
      installationFee: Math.round(Number(installationFee)),
    });

    return NextResponse.json({
      success: true,
      message: 'Registration approved and PPPoE user created',
      pppoeUser: {
        id: pppoeUser.id,
        username: pppoeUser.username,
        password: pppoeUser.password,
        status: pppoeUser.status,
      },
    });
  } catch (error: any) {
    console.error('Approve registration error:', error);
    return NextResponse.json(
      { error: 'Failed to approve registration' },
      { status: 500 }
    );
  }
}
