import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Get invoice by payment token
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

    // Find invoice by payment token
    const invoice = await prisma.invoice.findUnique({
      where: {
        paymentToken: token,
      },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
            username: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or invalid payment link' },
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
      invoice: {
        ...invoice,
        // Use snapshot if user is deleted
        customerName: invoice.user?.name || invoice.customerName,
        customerPhone: invoice.user?.phone || invoice.customerPhone,
      },
      paymentGateways,
      company,
    });
  } catch (error) {
    console.error('Get invoice by token error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}
