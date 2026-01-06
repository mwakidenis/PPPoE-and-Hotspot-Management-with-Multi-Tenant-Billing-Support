import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInstallationInvoice } from '@/lib/whatsapp-notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get registration
    const registration = await prisma.registrationRequest.findUnique({
      where: { id },
      include: {
        profile: true,
        pppoeUser: true,
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Registration must be approved first' },
        { status: 400 }
      );
    }

    if (!registration.pppoeUser) {
      return NextResponse.json(
        { error: 'PPPoE user not created yet' },
        { status: 400 }
      );
    }

    if (registration.invoiceId) {
      return NextResponse.json(
        { error: 'Installation invoice already generated' },
        { status: 400 }
      );
    }

    // Generate invoice number: INV-YYYYMM-XXXX
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;
    
    const count = await prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
    });
    
    const invoiceNumber = `${prefix}${String(count + 1).padStart(4, '0')}`;

    // Generate payment token
    const paymentToken = `PAY-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Create invoice for installation
    const invoice = await prisma.invoice.create({
      data: {
        id: crypto.randomUUID(),
        invoiceNumber,
        userId: registration.pppoeUserId,
        amount: Math.round(Number(registration.installationFee)),
        status: 'PENDING',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        customerName: registration.name,
        customerPhone: registration.phone,
        customerUsername: registration.pppoeUser.username,
        paymentToken,
      },
    });

    // Get company baseUrl from database
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const paymentLink = `${baseUrl}/pay/${paymentToken}`;

    // Update invoice with payment link
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { paymentLink },
    });

    // Update registration
    await prisma.registrationRequest.update({
      where: { id },
      data: {
        status: 'INSTALLED',
        invoiceId: invoice.id,
      },
    });

    // Send WhatsApp notification with invoice
    await sendInstallationInvoice({
      customerName: registration.name,
      customerPhone: registration.phone,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      paymentLink,
      dueDate: invoice.dueDate,
    });

    return NextResponse.json({
      success: true,
      message: 'Installation marked as done and invoice generated',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        status: invoice.status,
        dueDate: invoice.dueDate,
        paymentLink,
      },
    });
  } catch (error: any) {
    console.error('Mark installed error:', error);
    return NextResponse.json(
      { error: 'Failed to mark installation done' },
      { status: 500 }
    );
  }
}
