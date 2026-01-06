import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMidtransPayment } from '@/lib/payment/midtrans';
import { createXenditInvoice } from '@/lib/payment/xendit';
import { createDuitkuClient } from '@/lib/payment/duitku';

export const dynamic = 'force-dynamic';

/**
 * Create Payment Transaction
 * POST /api/payment/create
 * Body: { invoiceId, gateway }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { invoiceId, orderNumber, amount, gateway, type } = body;

    // For voucher orders
    if (type === 'voucher') {
      if (!orderNumber || !amount || !gateway) {
        return NextResponse.json(
          { error: 'Order number, amount and gateway are required for voucher orders' },
          { status: 400 }
        );
      }

      const order = await prisma.voucherOrder.findFirst({
        where: { orderNumber },
        include: { profile: true }
      });

      if (!order) {
        return NextResponse.json({ error: 'Voucher order not found' }, { status: 404 });
      }

      if (order.status === 'PAID') {
        return NextResponse.json({ error: 'Order already paid' }, { status: 400 });
      }

      return await createVoucherPayment(order, gateway);
    }

    // For invoices (PPPoE)
    if (!invoiceId || !gateway) {
      return NextResponse.json(
        { error: 'Invoice ID and gateway are required' },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { error: 'Invoice already paid' },
        { status: 400 }
      );
    }

    if (!invoice.paymentToken) {
      return NextResponse.json(
        { error: 'Invoice payment token not found' },
        { status: 400 }
      );
    }

    // Check if payment gateway is active
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: gateway }
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Payment gateway not available' },
        { status: 400 }
      );
    }

    // Skip checking for existing pending payment for now
    // User can create new payment attempt if needed

    // Get customer info (use snapshot if user deleted)
    const customerName = invoice.user?.name || invoice.customerName || 'Customer';
    const customerPhone = invoice.user?.phone || invoice.customerPhone || '08123456789';
    const customerEmail = invoice.user?.email || `invoice-${invoice.invoiceNumber}@example.com`;

    // Generate unique order ID
    const orderId = `INV-${invoice.invoiceNumber}-${Date.now()}`;

    let paymentUrl = '';
    let snapToken = '';
    let transactionId = '';

    // ============================================
    // CREATE PAYMENT VIA GATEWAY
    // ============================================

    if (gateway === 'midtrans') {
      try {
        const result = await createMidtransPayment({
          orderId,
          amount: invoice.amount,
          customerName,
          customerEmail,
          customerPhone,
          invoiceToken: invoice.paymentToken,
          items: [
            {
              id: invoice.id,
              name: `Invoice ${invoice.invoiceNumber}`,
              price: invoice.amount,
              quantity: 1
            }
          ]
        });

        snapToken = result.token;
        paymentUrl = result.redirect_url;
      } catch (error) {
        console.error('[Midtrans] Payment creation error:', error);
        return NextResponse.json(
          { error: 'Failed to create Midtrans payment', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        );
      }
    } else if (gateway === 'xendit') {
      try {
        const result = await createXenditInvoice({
          externalId: orderId,
          amount: invoice.amount,
          payerEmail: customerEmail,
          description: `Payment for Invoice ${invoice.invoiceNumber}`,
          customerName,
          customerPhone,
          invoiceToken: invoice.paymentToken
        });

        console.log('[Xendit] Response:', JSON.stringify(result, null, 2));
        
        transactionId = result.id;
        paymentUrl = result.invoice_url || result.invoiceUrl || '';
        
        if (!paymentUrl) {
          console.error('[Xendit] No payment URL in response:', result);
        }
      } catch (error) {
        console.error('[Xendit] Payment creation error:', error);
        return NextResponse.json(
          { error: 'Failed to create Xendit payment', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        );
      }
    } else if (gateway === 'duitku') {
      try {
        const duitku = createDuitkuClient(
          gatewayConfig.duitkuMerchantCode || '',
          gatewayConfig.duitkuApiKey || '',
          `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook`,
          `${process.env.NEXT_PUBLIC_APP_URL}/pay/${invoice.paymentToken}`,
          gatewayConfig.duitkuEnvironment === 'sandbox'
        );

        const result = await duitku.createInvoice({
          invoiceId: orderId,
          amount: invoice.amount,
          customerName,
          customerEmail,
          description: `Payment for Invoice ${invoice.invoiceNumber}`,
          expiryMinutes: 1440 // 24 hours
        });

        transactionId = result.reference;
        paymentUrl = result.paymentUrl;
        
        console.log('[Duitku] Payment created:', result.reference);
      } catch (error) {
        console.error('[Duitku] Payment creation error:', error);
        return NextResponse.json(
          { error: 'Failed to create Duitku payment', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported payment gateway' },
        { status: 400 }
      );
    }

    // ============================================
    // SAVE PAYMENT TO DATABASE
    // ============================================

    const payment = await prisma.payment.create({
      data: {
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        amount: invoice.amount,
        method: `${gateway}_${gateway === 'midtrans' ? 'snap' : 'invoice'}`,
        gatewayId: gatewayConfig.id,
        status: 'pending'
      }
    });

    console.log(`✅ Payment created: ${orderId} via ${gateway.toUpperCase()}`);
    
    // Create webhook log for pending payment
    try {
      await prisma.webhookLog.create({
        data: {
          id: crypto.randomUUID(),
          gateway,
          orderId,
          status: 'pending',
          transactionId: transactionId || null,
          amount: invoice.amount,
          payload: JSON.stringify({ type: 'invoice', invoiceId: invoice.id, createdAt: new Date() }),
          response: JSON.stringify({ paymentUrl, snapToken: snapToken || null }),
          success: true
        }
      });
      console.log(`✅ Webhook log created for ${orderId}`);
    } catch (logError) {
      console.error('Failed to create webhook log:', logError);
    }

    return NextResponse.json({
      success: true,
      payment,
      orderId,
      paymentUrl,
      snapToken
    });

  } catch (error) {
    console.error('❌ Payment creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Create payment for voucher order
async function createVoucherPayment(order: any, gateway: string) {
  // Check if payment gateway is active
  const gatewayConfig = await prisma.paymentGateway.findUnique({
    where: { provider: gateway }
  });

  if (!gatewayConfig || !gatewayConfig.isActive) {
    return NextResponse.json(
      { error: 'Payment gateway not available' },
      { status: 400 }
    );
  }

  const customerName = order.customerName;
  const customerPhone = order.customerPhone;
  const customerEmail = order.customerEmail || `order-${order.orderNumber}@example.com`;
  const orderId = `${order.orderNumber}-${Date.now()}`;

  let paymentUrl = '';
  let snapToken = '';

  // Get base URL for return redirect
  const company = await prisma.company.findFirst();
  const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  if (gateway === 'midtrans') {
    try {
      const snap = new (await import('midtrans-client')).default.Snap({
        isProduction: gatewayConfig.midtransEnvironment === 'production',
        serverKey: gatewayConfig.midtransServerKey!,
        clientKey: gatewayConfig.midtransClientKey!
      });

      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: order.totalAmount
        },
        customer_details: {
          first_name: customerName,
          email: customerEmail,
          phone: customerPhone
        },
        item_details: [
          {
            id: order.id,
            name: `Voucher ${order.profile.name} (${order.quantity}x)`,
            price: order.totalAmount,
            quantity: 1
          }
        ],
        callbacks: {
          finish: `${baseUrl}/evoucher/pay/${order.paymentToken}?status=success`,
          error: `${baseUrl}/evoucher/pay/${order.paymentToken}?status=failed`,
          pending: `${baseUrl}/evoucher/pay/${order.paymentToken}?status=pending`
        }
      };

      const transaction = await snap.createTransaction(parameter);
      snapToken = transaction.token;
      paymentUrl = transaction.redirect_url;
    } catch (error) {
      console.error('[Midtrans] Payment creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create Midtrans payment', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } else if (gateway === 'xendit') {
    try {
      const { Xendit } = await import('xendit-node');
      const xendit = new Xendit({ secretKey: gatewayConfig.xenditApiKey! });
      const { Invoice } = xendit;
      
      const invoice = await Invoice.createInvoice({
        data: {
          externalId: orderId,
          amount: order.totalAmount,
          payerEmail: customerEmail,
          description: `Payment for Voucher Order ${order.orderNumber}`,
          customer: {
            givenNames: customerName,
            mobileNumber: customerPhone
          },
          invoiceDuration: 86400,
          currency: 'IDR',
          reminderTime: 1,
          successRedirectUrl: `${baseUrl}/evoucher/pay/${order.paymentToken}?status=success`,
          failureRedirectUrl: `${baseUrl}/evoucher/pay/${order.paymentToken}?status=failed`
        }
      });

      console.log('[Xendit Voucher] Response:', JSON.stringify(invoice, null, 2));
      paymentUrl = (invoice as any).invoice_url || (invoice as any).invoiceUrl || '';
    } catch (error) {
      console.error('[Xendit] Payment creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create Xendit payment', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } else if (gateway === 'duitku') {
    try {
      const duitku = createDuitkuClient(
        gatewayConfig.duitkuMerchantCode || '',
        gatewayConfig.duitkuApiKey || '',
        `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook`,
        `${baseUrl}/evoucher/pay/${order.paymentToken}`,
        gatewayConfig.duitkuEnvironment === 'sandbox'
      );

      const result = await duitku.createInvoice({
        invoiceId: orderId,
        amount: order.totalAmount,
        customerName,
        customerEmail,
        description: `Payment for Voucher Order ${order.orderNumber}`,
        expiryMinutes: 1440 // 24 hours
      });

      paymentUrl = result.paymentUrl;
      console.log('[Duitku Voucher] Payment created:', result.reference);
    } catch (error) {
      console.error('[Duitku] Payment creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create Duitku payment', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } else {
    return NextResponse.json(
      { error: 'Unsupported payment gateway' },
      { status: 400 }
    );
  }

  console.log(`✅ Voucher payment created: ${orderId} via ${gateway.toUpperCase()}`);
  
  // Create webhook log for pending payment
  try {
    await prisma.webhookLog.create({
      data: {
        id: crypto.randomUUID(),
        gateway,
        orderId,
        status: 'pending',
        transactionId: null,
        amount: order.totalAmount,
        payload: JSON.stringify({ type: 'voucher', orderId: order.id, orderNumber: order.orderNumber, createdAt: new Date() }),
        response: JSON.stringify({ paymentUrl, snapToken: snapToken || null }),
        success: true
      }
    });
    console.log(`✅ Webhook log created for voucher ${orderId}`);
  } catch (logError) {
    console.error('Failed to create webhook log:', logError);
  }

  return NextResponse.json({
    success: true,
    orderId,
    paymentUrl,
    snapToken
  });
}
