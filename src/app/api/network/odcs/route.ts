import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

// GET - Fetch all ODCs
export async function GET() {
  try {
    const odcs = await prisma.networkODC.findMany({
      include: {
        olt: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
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

    return NextResponse.json({ success: true, odcs });
  } catch (error: any) {
    console.error('Error fetching ODCs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ODCs' },
      { status: 500 }
    );
  }
}

// POST - Create new ODC
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, latitude, longitude, oltId, ponPort, portCount, followRoad } = body;

    // Validation
    if (!name || !latitude || !longitude || !oltId || ponPort === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if OLT exists
    const olt = await prisma.networkOLT.findUnique({
      where: { id: oltId },
    });

    if (!olt) {
      return NextResponse.json(
        { success: false, error: 'OLT not found' },
        { status: 404 }
      );
    }

    // Create ODC
    const odc = await prisma.networkODC.create({
      data: {
        id: nanoid(),
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        oltId,
        ponPort: parseInt(ponPort),
        portCount: portCount ? parseInt(portCount) : 8,
        followRoad: followRoad || false,
        status: 'active',
      },
      include: {
        olt: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, odc });
  } catch (error: any) {
    console.error('Error creating ODC:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create ODC' },
      { status: 500 }
    );
  }
}

// PUT - Update ODC
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, latitude, longitude, oltId, ponPort, portCount, followRoad, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ODC ID is required' },
        { status: 400 }
      );
    }

    // Check if ODC exists
    const existingOdc = await prisma.networkODC.findUnique({
      where: { id },
    });

    if (!existingOdc) {
      return NextResponse.json(
        { success: false, error: 'ODC not found' },
        { status: 404 }
      );
    }

    // Update ODC
    const odc = await prisma.networkODC.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(latitude && { latitude: parseFloat(latitude) }),
        ...(longitude && { longitude: parseFloat(longitude) }),
        ...(oltId && { oltId }),
        ...(ponPort !== undefined && { ponPort: parseInt(ponPort) }),
        ...(portCount !== undefined && { portCount: parseInt(portCount) }),
        ...(followRoad !== undefined && { followRoad }),
        ...(status && { status }),
      },
      include: {
        olt: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, odc });
  } catch (error: any) {
    console.error('Error updating ODC:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update ODC' },
      { status: 500 }
    );
  }
}

// DELETE - Delete ODC
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ODC ID is required' },
        { status: 400 }
      );
    }

    // Check if ODC exists
    const existingOdc = await prisma.networkODC.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            odps: true,
          },
        },
      },
    });

    if (!existingOdc) {
      return NextResponse.json(
        { success: false, error: 'ODC not found' },
        { status: 404 }
      );
    }

    // Check if ODC has ODPs
    if (existingOdc._count.odps > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete ODC with ${existingOdc._count.odps} connected ODP(s). Please delete or reassign them first.`,
        },
        { status: 400 }
      );
    }

    // Delete ODC
    await prisma.networkODC.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'ODC deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting ODC:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete ODC' },
      { status: 500 }
    );
  }
}
