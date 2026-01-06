import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// Generate secure payment token
function generatePaymentToken(): string {
  return randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  
  try {
    const body = await request.json();
    const { profileId, customerName, customerPhone, customerEmail, quantity = 1 } = body;
    
    console.log('=== E-VOUCHER PURCHASE REQUEST ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Client IP:', clientIp);
    console.log('Customer:', customerName, '|', customerPhone);
    console.log('Profile ID:', profileId);
    console.log('Quantity:', quantity);

    if (!profileId || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate profile exists and has e-voucher access
    const profile = await prisma.hotspotProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!profile.eVoucherAccess || !profile.isActive) {
      return NextResponse.json(
        { error: 'Profile not available for e-voucher' },
        { status: 403 }
      );
    }

    // Generate order number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const count = await prisma.voucherOrder.count({
      where: {
        orderNumber: {
          startsWith: `EVC-${year}${month}${day}-`,
        },
      },
    });
    const orderNumber = `EVC-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;

    // Calculate total amount
    const totalAmount = profile.sellingPrice * quantity;

    // Get company base URL for payment link
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Generate payment token and link
    const paymentToken = generatePaymentToken();
    const paymentLink = `${baseUrl}/evoucher/pay/${paymentToken}`;

    // Create voucher order
    const order = await prisma.voucherOrder.create({
      data: {
        id: crypto.randomUUID(),
        orderNumber,
        profileId: profile.id,
        quantity,
        customerName,
        customerPhone,
        customerEmail,
        totalAmount,
        status: 'PENDING',
        paymentToken,
        paymentLink,
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
      },
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Voucher order created: ${orderNumber} for ${customerName} (${duration}ms)`);
    console.log(`Payment Link: ${paymentLink}`);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        paymentToken: order.paymentToken,
        paymentLink: order.paymentLink,
        totalAmount: order.totalAmount,
        profile: order.profile,
      },
      message: 'Order created successfully. Please proceed to payment.',
    }, { status: 201 });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ E-voucher purchase error:', error);
    console.error('Duration:', duration + 'ms');
    console.error('Client IP:', clientIp);
    
    return NextResponse.json(
      { error: 'Failed to create order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
