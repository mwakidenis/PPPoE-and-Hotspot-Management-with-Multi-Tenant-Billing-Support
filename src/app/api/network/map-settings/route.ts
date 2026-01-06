import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get or create default settings
    let settings = await prisma.mapSettings.findFirst();

    if (!settings) {
      // Create default settings if not exists
      settings = await prisma.mapSettings.create({
        data: {
          id: crypto.randomUUID(),
          osrmApiUrl: 'http://router.project-osrm.org',
          followRoad: false,
          defaultLat: -7.071273611475302,
          defaultLon: 108.04475042198051,
          defaultZoom: 13,
          mapTheme: 'default',
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('Get map settings error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { osrmApiUrl, followRoad, defaultLat, defaultLon, defaultZoom, mapTheme } = body;

    // Get existing settings
    let settings = await prisma.mapSettings.findFirst();

    if (!settings) {
      // Create if not exists
      settings = await prisma.mapSettings.create({
        data: {
          id: crypto.randomUUID(),
          osrmApiUrl: osrmApiUrl || 'http://router.project-osrm.org',
          followRoad: followRoad !== undefined ? followRoad : false,
          defaultLat: defaultLat !== undefined ? parseFloat(defaultLat) : -7.071273611475302,
          defaultLon: defaultLon !== undefined ? parseFloat(defaultLon) : 108.04475042198051,
          defaultZoom: defaultZoom !== undefined ? parseInt(defaultZoom) : 13,
          mapTheme: mapTheme || 'default',
        },
      });
    } else {
      // Update existing
      settings = await prisma.mapSettings.update({
        where: { id: settings.id },
        data: {
          ...(osrmApiUrl !== undefined && { osrmApiUrl }),
          ...(followRoad !== undefined && { followRoad }),
          ...(defaultLat !== undefined && { defaultLat: parseFloat(defaultLat) }),
          ...(defaultLon !== undefined && { defaultLon: parseFloat(defaultLon) }),
          ...(defaultZoom !== undefined && { defaultZoom: parseInt(defaultZoom) }),
          ...(mapTheme !== undefined && { mapTheme }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('Update map settings error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
