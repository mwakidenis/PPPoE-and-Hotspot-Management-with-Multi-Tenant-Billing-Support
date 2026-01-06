import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const servers = await prisma.networkServer.findMany({
      include: {
        router: {
          select: {
            name: true,
            nasname: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      servers,
    });
  } catch (error: any) {
    console.error('Get servers error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ipAddress, latitude, longitude, status, routerId } = body;

    if (!name || !ipAddress || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, IP address, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const server = await prisma.networkServer.create({
      data: {
        id: crypto.randomUUID(),
        name,
        ipAddress,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status: status || 'active',
        routerId: routerId || null,
      },
    });

    return NextResponse.json({
      success: true,
      server,
    });
  } catch (error: any) {
    console.error('Create server error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, ipAddress, latitude, longitude, status, routerId } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Server ID is required' },
        { status: 400 }
      );
    }

    const server = await prisma.networkServer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(ipAddress && { ipAddress }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(status && { status }),
        ...(routerId !== undefined && { routerId: routerId || null }),
      },
    });

    return NextResponse.json({
      success: true,
      server,
    });
  } catch (error: any) {
    console.error('Update server error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Server ID is required' },
        { status: 400 }
      );
    }

    await prisma.networkServer.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Server deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete server error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
