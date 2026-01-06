import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

// GET - Fetch all ODPs
export async function GET() {
  try {
    const odps = await prisma.networkODP.findMany({
      include: {
        olt: {
          select: {
            name: true,
            ipAddress: true,
          },
        },
        odc: {
          select: {
            name: true,
          },
        },
        parentOdp: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            childOdps: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      odps,
    });
  } catch (error: any) {
    console.error('Get ODPs error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new ODP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, latitude, longitude, odcId, parentOdpId, ponPort, oltId, portCount, followRoad } = body;

    // Validation
    if (!name || !latitude || !longitude || !ponPort || !oltId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!odcId && !parentOdpId) {
      return NextResponse.json(
        { success: false, error: 'Either odcId or parentOdpId is required' },
        { status: 400 }
      );
    }

    // Create ODP
    const odp = await prisma.networkODP.create({
      data: {
        id: nanoid(),
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        oltId,
        ponPort: parseInt(ponPort),
        portCount: portCount ? parseInt(portCount) : 8,
        odcId: odcId || null,
        parentOdpId: parentOdpId || null,
        followRoad: followRoad || false,
        status: 'active',
      },
      include: {
        olt: true,
        odc: true,
        parentOdp: true,
      },
    });

    return NextResponse.json({ success: true, odp });
  } catch (error: any) {
    console.error('Error creating ODP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create ODP' },
      { status: 500 }
    );
  }
}

// PUT - Update ODP
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, latitude, longitude, odcId, parentOdpId, ponPort, oltId, portCount, followRoad, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ODP ID is required' },
        { status: 400 }
      );
    }

    // Check if ODP exists
    const existingOdp = await prisma.networkODP.findUnique({
      where: { id },
    });

    if (!existingOdp) {
      return NextResponse.json(
        { success: false, error: 'ODP not found' },
        { status: 404 }
      );
    }

    // Update ODP
    const odp = await prisma.networkODP.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(latitude && { latitude: parseFloat(latitude) }),
        ...(longitude && { longitude: parseFloat(longitude) }),
        ...(oltId && { oltId }),
        ...(ponPort !== undefined && { ponPort: parseInt(ponPort) }),
        ...(portCount !== undefined && { portCount: parseInt(portCount) }),
        ...(odcId !== undefined && { odcId: odcId || null }),
        ...(parentOdpId !== undefined && { parentOdpId: parentOdpId || null }),
        ...(followRoad !== undefined && { followRoad }),
        ...(status && { status }),
      },
      include: {
        olt: true,
        odc: true,
        parentOdp: true,
      },
    });

    return NextResponse.json({ success: true, odp });
  } catch (error: any) {
    console.error('Error updating ODP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update ODP' },
      { status: 500 }
    );
  }
}

// DELETE - Delete ODP
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ODP ID is required' },
        { status: 400 }
      );
    }

    // Check if ODP exists
    const existingOdp = await prisma.networkODP.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            childOdps: true,
          },
        },
      },
    });

    if (!existingOdp) {
      return NextResponse.json(
        { success: false, error: 'ODP not found' },
        { status: 404 }
      );
    }

    // Check if ODP has children
    if (existingOdp._count.childOdps > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete ODP with ${existingOdp._count.childOdps} child ODP(s). Please delete or reassign them first.`,
        },
        { status: 400 }
      );
    }

    // Delete ODP
    await prisma.networkODP.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'ODP deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting ODP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete ODP' },
      { status: 500 }
    );
  }
}
