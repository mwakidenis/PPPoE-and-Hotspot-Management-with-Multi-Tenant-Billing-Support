import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { RouterOSAPI } from 'node-routeros';

const prisma = new PrismaClient();

// GET - Load all VPN clients
export async function GET() {
  try {
    const clients = await prisma.vpnClient.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const vpnServer = await prisma.vpnServer.findFirst();

    return NextResponse.json({
      clients,
      vpnServer,
    });
  } catch (error: any) {
    console.error('Load clients error:', error);
    return NextResponse.json({
      error: error.message,
      clients: [],
    }, { status: 500 });
  }
}

// POST - Create new VPN client
export async function POST(request: Request) {
  try {
    const { name, description } = await request.json();

    // Get VPN server config
    const vpnServer = await prisma.vpnServer.findFirst();
    if (!vpnServer) {
      return NextResponse.json(
        { error: 'VPN server not configured' },
        { status: 400 }
      );
    }

    // Generate credentials
    const username = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
    
    // Parse subnet from VPN server config
    const subnetParts = (vpnServer.subnet || '10.20.30.0/24').split('/');
    const baseIp = subnetParts[0].split('.');
    const networkBase = `${baseIp[0]}.${baseIp[1]}.${baseIp[2]}`;
    
    // Get next available IP from server's subnet
    const existingClients = await prisma.vpnClient.findMany();
    const usedIps = existingClients
      .filter(c => c.vpnIp.startsWith(networkBase))
      .map(c => parseInt(c.vpnIp.split('.')[3]));
    let nextIp = 2;
    while (usedIps.includes(nextIp)) {
      nextIp++;
    }
    const vpnIp = `${networkBase}.${nextIp}`;

    // Connect to CHR
    const conn = new RouterOSAPI({
      host: vpnServer.host,
      user: vpnServer.username,
      password: vpnServer.password,
      port: vpnServer.port,
      timeout: 10,
    });

    await conn.connect();

    // Add PPP secret
    await conn.write('/ppp/secret/add', [
      `=name=${username}`,
      `=password=${password}`,
      `=service=any`,
      `=profile=vpn-profile`,
      `=remote-address=${vpnIp}`,
      `=comment=AIBILL-${name}`,
    ]);

    await conn.close();

    // Save to database
    const client = await prisma.vpnClient.create({
      data: {
        id: crypto.randomUUID(),
        name,
        vpnIp,
        username,
        password,
        description: description || null,
        vpnType: 'L2TP',
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      client,
      credentials: {
        server: vpnServer.host,
        username,
        password,
        ipsecSecret: 'aibill-secret',
        vpnIp,
      },
    });
  } catch (error: any) {
    console.error('Create client error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create client' },
      { status: 500 }
    );
  }
}

// PUT - Update VPN client (toggle RADIUS server)
export async function PUT(request: Request) {
  try {
    const { id, isRadiusServer } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    // If setting as RADIUS server, unset others first
    if (isRadiusServer) {
      await prisma.vpnClient.updateMany({
        where: { isRadiusServer: true },
        data: { isRadiusServer: false },
      });
    }

    // Update client
    const client = await prisma.vpnClient.update({
      where: { id },
      data: { isRadiusServer },
    });

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    console.error('Update client error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove VPN client
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    // Get client info
    const client = await prisma.vpnClient.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get VPN server config
    const vpnServer = await prisma.vpnServer.findFirst();
    if (vpnServer) {
      try {
        const conn = new RouterOSAPI({
          host: vpnServer.host,
          user: vpnServer.username,
          password: vpnServer.password,
          port: vpnServer.port,
          timeout: 10,
        });

        await conn.connect();

        // Find and remove PPP secret
        const secrets = await conn.write('/ppp/secret/print', [
          `?name=${client.username}`,
        ]);

        if (secrets.length > 0) {
          await conn.write('/ppp/secret/remove', [
            `=.id=${secrets[0]['.id']}`,
          ]);
        }

        await conn.close();
      } catch (error) {
        console.error('CHR delete error:', error);
        // Continue to delete from DB even if CHR fails
      }
    }

    // Delete from database
    await prisma.vpnClient.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete client error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
