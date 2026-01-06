import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { reloadFreeRadius } from '@/lib/freeradius';
const RouterOSAPI = require('node-routeros').RouterOSAPI;

const prisma = new PrismaClient();

// GET - Load all routers
export async function GET() {
  try {
    const routers = await prisma.router.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ routers });
  } catch (error) {
    console.error('Load routers error:', error);
    return NextResponse.json({ error: 'Failed to load routers' }, { status: 500 });
  }
}

// POST - Add new router
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ipAddress, username, password, port, apiPort, secret, vpnClientId } = body;

    if (!name || !ipAddress || !username || !password) {
      return NextResponse.json(
        { error: 'Name, IP address, username, and password are required' },
        { status: 400 }
      );
    }

    // Generate shortname from name (remove spaces, lowercase)
    const shortname = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const nasname = ipAddress; // Use IP as nasname for RADIUS

    // Test connection to MikroTik
    try {
      const conn = new RouterOSAPI({
        host: ipAddress,
        user: username,
        password: password,
        port: port || 8728,
        timeout: 5,
      });

      await conn.connect();
      
      // Get router identity
      const identity = await conn.write('/system/identity/print');
      
      conn.close();

      // Save to database
      const router = await prisma.router.create({
        data: {
          id: crypto.randomUUID(),
          name,
          nasname,
          shortname,
          type: 'mikrotik',
          ipAddress,
          username,
          password,
          port: port || 8728,
          apiPort: apiPort || 8729,
          secret: secret || 'secret123',
          ports: 1812, // RADIUS auth port
          description: `MikroTik Router - ${name}`,
          vpnClientId: vpnClientId || null,
          isActive: true,
        },
      });

      // Restart FreeRADIUS to reload NAS table
      await reloadFreeRadius();

      return NextResponse.json({
        success: true,
        router,
        identity: identity[0]?.name || 'Unknown',
        message: 'Router added and connection test successful',
      });
    } catch (connError: any) {
      console.error('Router connection error:', connError);
      return NextResponse.json(
        { 
          error: 'Failed to connect to router', 
          details: connError.message,
          hint: 'Check IP address, username, password, and port. Ensure MikroTik API service is enabled.',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Add router error:', error);
    return NextResponse.json({ error: 'Failed to add router' }, { status: 500 });
  }
}

// PUT - Update router
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, ipAddress, username, password, port, apiPort, secret, vpnClientId, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Router ID is required' }, { status: 400 });
    }

    // Generate shortname from name if name is provided
    const shortname = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : undefined;
    const nasname = ipAddress || undefined;

    // Test connection if credentials changed
    if (ipAddress || username || password || port) {
      const currentRouter = await prisma.router.findUnique({ where: { id } });
      if (!currentRouter) {
        return NextResponse.json({ error: 'Router not found' }, { status: 404 });
      }

      try {
        const conn = new RouterOSAPI({
          host: ipAddress || currentRouter.ipAddress,
          user: username || currentRouter.username,
          password: password || currentRouter.password,
          port: port || currentRouter.port,
          timeout: 5,
        });

        await conn.connect();
        conn.close();
      } catch (connError: any) {
        return NextResponse.json(
          { 
            error: 'Failed to connect with new credentials', 
            details: connError.message 
          },
          { status: 400 }
        );
      }
    }

    const router = await prisma.router.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(shortname && { shortname }),
        ...(nasname && { nasname }),
        ...(ipAddress && { ipAddress }),
        ...(username && { username }),
        ...(password && { password }),
        ...(port && { port }),
        ...(apiPort && { apiPort }),
        ...(secret && { secret }),
        ...(vpnClientId !== undefined && { vpnClientId: vpnClientId || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Restart FreeRADIUS to reload NAS table
    await reloadFreeRadius();

    return NextResponse.json({ success: true, router });
  } catch (error) {
    console.error('Update router error:', error);
    return NextResponse.json({ error: 'Failed to update router' }, { status: 500 });
  }
}

// DELETE - Remove router
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Router ID is required' }, { status: 400 });
    }

    await prisma.router.delete({
      where: { id },
    });

    // Restart FreeRADIUS to reload NAS table
    await reloadFreeRadius();

    return NextResponse.json({ success: true, message: 'Router deleted successfully' });
  } catch (error) {
    console.error('Delete router error:', error);
    return NextResponse.json({ error: 'Failed to delete router' }, { status: 500 });
  }
}
