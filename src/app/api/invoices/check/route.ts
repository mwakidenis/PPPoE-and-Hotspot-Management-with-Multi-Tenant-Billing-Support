import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Check invoice status by payment token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

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
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        amount: true,
        paidAt: true,
        createdAt: true,
        dueDate: true,
        customerName: true,
        customerPhone: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      invoice,
    });
  } catch (error) {
    console.error('Check invoice status error:', error);
    return NextResponse.json(
      { error: 'Failed to check invoice status' },
      { status: 500 }
    );
  }
}
