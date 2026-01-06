import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const olts = await prisma.networkOLT.findMany({
      include: {
        routers: {
          include: {
            router: {
              select: {
                id: true,
                name: true,
                nasname: true,
                ipAddress: true,
              },
            },
          },
          orderBy: {
            priority: 'asc',
          },
        },
        _count: {
          select: {
            odps: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      olts,
    });
  } catch (error: any) {
    console.error('Get OLTs error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ipAddress, latitude, longitude, status, routerIds, ponPorts, followRoad } = body;

    if (!name || !ipAddress || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, IP address, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const oltId = crypto.randomUUID();

    // Create OLT
    const olt = await prisma.networkOLT.create({
      data: {
        id: oltId,
        name,
        ipAddress,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status: status || 'active',
        followRoad: followRoad || false,
      },
    });

    // Create router assignments if provided
    if (routerIds && Array.isArray(routerIds) && routerIds.length > 0) {
      await prisma.networkOLTRouter.createMany({
        data: routerIds.map((routerId: string, index: number) => ({
          id: crypto.randomUUID(),
          oltId,
          routerId,
          priority: index,
          isActive: true,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      olt,
    });
  } catch (error: any) {
    console.error('Create OLT error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, ipAddress, latitude, longitude, status, routerIds, followRoad } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'OLT ID is required' },
        { status: 400 }
      );
    }

    // Update OLT
    const olt = await prisma.networkOLT.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(ipAddress && { ipAddress }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(status && { status }),
        ...(followRoad !== undefined && { followRoad }),
      },
    });

    // Update router assignments if provided
    if (routerIds && Array.isArray(routerIds)) {
      // Delete existing assignments
      await prisma.networkOLTRouter.deleteMany({
        where: { oltId: id },
      });

      // Create new assignments
      if (routerIds.length > 0) {
        await prisma.networkOLTRouter.createMany({
          data: routerIds.map((routerId: string, index: number) => ({
            id: crypto.randomUUID(),
            oltId: id,
            routerId,
            priority: index,
            isActive: true,
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      olt,
    });
  } catch (error: any) {
    console.error('Update OLT error:', error);
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
        { success: false, error: 'OLT ID is required' },
        { status: 400 }
      );
    }

    await prisma.networkOLT.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'OLT deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete OLT error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
