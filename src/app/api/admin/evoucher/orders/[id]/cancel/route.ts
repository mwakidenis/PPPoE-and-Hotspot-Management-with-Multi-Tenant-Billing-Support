import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if order exists and is PENDING
    const order = await prisma.voucherOrder.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Only pending orders can be cancelled' },
        { status: 400 }
      );
    }

    // Update order status
    await prisma.voucherOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    console.log(`✅ Order ${order.orderNumber} cancelled by admin`);

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  } catch (error: any) {
    console.error('Cancel order error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
