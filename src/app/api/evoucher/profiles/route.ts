import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const profiles = await prisma.hotspotProfile.findMany({
      where: {
        isActive: true,
        eVoucherAccess: true, // Only profiles with e-voucher access
      },
      select: {
        id: true,
        name: true,
        sellingPrice: true,
        speed: true,
        validityValue: true,
        validityUnit: true,
        eVoucherAccess: true,
      },
      orderBy: {
        sellingPrice: 'asc',
      },
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Get e-voucher profiles error:', error);
    return NextResponse.json(
      { error: 'Failed to load profiles' },
      { status: 500 }
    );
  }
}
