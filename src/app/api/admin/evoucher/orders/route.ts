import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const orders = await prisma.voucherOrder.findMany({
      include: {
        profile: {
          select: {
            name: true,
            speed: true,
            validityValue: true,
            validityUnit: true,
          },
        },
        vouchers: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error: any) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
