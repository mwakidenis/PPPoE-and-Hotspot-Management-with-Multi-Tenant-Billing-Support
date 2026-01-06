import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Get voucher order by payment token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Payment token is required' },
        { status: 400 }
      );
    }

    // Find order by payment token
    const order = await prisma.voucherOrder.findUnique({
      where: {
        paymentToken: token,
      },
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
            code: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or invalid payment link' },
        { status: 404 }
      );
    }

    // Get active payment gateways
    const paymentGateways = await prisma.paymentGateway.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
      },
    });

    // Get company settings
    const company = await prisma.company.findFirst({
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
      },
    });

    return NextResponse.json({
      order,
      paymentGateways,
      company,
    });
  } catch (error) {
    console.error('Get voucher order by token error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
