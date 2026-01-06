import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { RouterOSAPI } from 'node-routeros';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { clientIds } = await request.json();

    if (!clientIds || clientIds.length === 0) {
      return NextResponse.json({ statusMap: {} });
    }

    // Get VPN server config
    const vpnServer = await prisma.vpnServer.findFirst();
    if (!vpnServer) {
      return NextResponse.json({ statusMap: {} });
    }

    // Get clients from DB
    const clients = await prisma.vpnClient.findMany({
      where: { id: { in: clientIds } },
    });

    const conn = new RouterOSAPI({
      host: vpnServer.host,
      user: vpnServer.username,
      password: vpnServer.password,
      port: vpnServer.port,
      timeout: 10,
    });

    await conn.connect();

    // Get active PPP connections
    const activeConnections = await conn.write('/ppp/active/print');

    await conn.close();

    // Build status map
    const statusMap: Record<string, boolean> = {};
    const activeUsernames = activeConnections.map((c: any) => c.name);

    for (const client of clients) {
      statusMap[client.id] = activeUsernames.includes(client.username);
    }

    return NextResponse.json({ statusMap });
  } catch (error: any) {
    console.error('Check status error:', error);
    return NextResponse.json(
      { error: error.message, statusMap: {} },
      { status: 500 }
    );
  }
}
