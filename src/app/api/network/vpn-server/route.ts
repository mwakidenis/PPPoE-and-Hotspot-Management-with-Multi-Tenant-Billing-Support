import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const vpnServer = await prisma.vpnServer.findFirst();
    
    if (!vpnServer) {
      return NextResponse.json({ configured: false });
    }

    // Don't send password to frontend
    const { password, ...safeData } = vpnServer;
    
    return NextResponse.json({
      configured: true,
      data: safeData,
    });
  } catch (error: any) {
    console.error('Get VPN server error:', error);
    return NextResponse.json({
      configured: false,
      error: error.message,
    }, { status: 500 });
  }
}
