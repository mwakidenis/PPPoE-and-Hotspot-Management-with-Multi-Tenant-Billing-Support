import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const profileId = searchParams.get('profileId');
    const routerId = searchParams.get('routerId');
    const address = searchParams.get('address');
    const odcId = searchParams.get('odcId');
    const odpIds = searchParams.get('odpIds'); // comma-separated ODP IDs

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (profileId) {
      where.profileId = profileId;
    }

    if (routerId) {
      where.routerId = routerId;
    }

    if (address) {
      where.address = {
        contains: address,
      };
    }

    // Filter by ODP
    if (odpIds) {
      const odpIdArray = odpIds.split(',').filter(Boolean);
      if (odpIdArray.length > 0) {
        where.odpAssignment = {
          odpId: {
            in: odpIdArray,
          },
        };
      }
    }

    // Filter by ODC (through ODP relationship)
    if (odcId && !odpIds) {
      where.odpAssignment = {
        odp: {
          odcId: odcId,
        },
      };
    }

    // Fetch users with filters
    const users = await prisma.pppoeUser.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        email: true,
        address: true,
        status: true,
        profileId: true,
        routerId: true,
        profile: {
          select: {
            name: true,
          },
        },
        router: {
          select: {
            name: true,
          },
        },
        odpAssignment: {
          select: {
            odp: {
              select: {
                id: true,
                name: true,
                odcId: true,
                odc: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get profiles and routers for filter options
    const profiles = await prisma.pppoeProfile.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    const routers = await prisma.router.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get ODCs and ODPs for filter options
    const odcs = await prisma.networkODC.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    const odps = await prisma.networkODP.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        odcId: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      users,
      filters: {
        profiles,
        routers,
        statuses: ['active', 'isolated', 'blocked'],
        odcs,
        odps,
      },
    });
  } catch (error: any) {
    console.error('Get users list error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
