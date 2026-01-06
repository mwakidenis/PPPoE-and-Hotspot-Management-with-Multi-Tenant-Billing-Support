import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncVoucherToRadius } from '@/lib/hotspot-radius-sync';
import { sendPaymentSuccess, sendVoucherPurchaseSuccess } from '@/lib/whatsapp-notifications';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

/**
 * Unified Payment Webhook Handler
 * Supports: Midtrans & Xendit
 * Single endpoint: /api/payment/webhook
 */
export async function POST(request: Request) {
  let webhookLogId: string | undefined;
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    
    // Duitku sends form-urlencoded, others send JSON
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.text();
      body = Object.fromEntries(new URLSearchParams(formData));
      console.log('[Webhook] Parsed form data:', body);
    } else {
      body = await request.json();
    }
    
    const signature = request.headers.get('x-callback-token') || request.headers.get('x-signature');
    
    console.log('=== PAYMENT WEBHOOK RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Content-Type:', contentType);
    console.log('Raw Body:', JSON.stringify(body, null, 2));
    console.log('Headers:', {
      signature: signature,
      contentType: contentType,
    });

    // Normalize payload (e.g., Xendit invoice events send { event, data })
    const payload: any = (body && body.event && body.data) ? body.data : body;
    
    let gateway = 'unknown';
    let orderId = '';
    let status = '';
    let transactionId = '';
    let paymentType = '';
    let paidAt: Date | null = null;
    let amount: number | undefined;
    
    // ============================================
    // DETECT PAYMENT GATEWAY
    // ============================================
    
    // MIDTRANS Detection
    if (payload.order_id && payload.transaction_status) {
      gateway = 'midtrans';
      orderId = payload.order_id;
      transactionId = payload.transaction_id || '';
      paymentType = payload.payment_type || '';
      amount = payload.gross_amount ? parseInt(payload.gross_amount) : undefined;
      
      const transactionStatus = payload.transaction_status;
      const fraudStatus = payload.fraud_status;
      
      // Map Midtrans status
      if (transactionStatus === 'capture') {
        status = fraudStatus === 'accept' ? 'settlement' : 'pending';
        if (fraudStatus === 'accept') paidAt = new Date();
      } else if (transactionStatus === 'settlement') {
        status = 'settlement';
        paidAt = new Date();
      } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
        status = transactionStatus;
      } else {
        status = 'pending';
      }
      
      // Verify Midtrans signature
      const gatewayConfig = await prisma.paymentGateway.findUnique({
        where: { provider: 'midtrans' }
      });
      
      if (gatewayConfig?.midtransServerKey) {
        const signatureKey = payload.signature_key;
        const expectedSignature = crypto
          .createHash('sha512')
          .update(orderId + payload.status_code + payload.gross_amount + gatewayConfig.midtransServerKey)
          .digest('hex');
        
        if (signatureKey !== expectedSignature) {
          console.error('[Midtrans] Invalid signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
      
      console.log('[Midtrans] Webhook processed');
    }
    // XENDIT Detection
    else if (payload.external_id && (payload.status || (body.event && payload.status))) {
      gateway = 'xendit';
      orderId = payload.external_id;
      transactionId = payload.id || '';
      paymentType = payload.payment_channel || payload.payment_method || '';
      amount = payload.amount ? parseInt(payload.amount) : undefined;
      
      const xenditStatus = (payload.status || '').toLowerCase();
      
      // Map Xendit status
      if (xenditStatus === 'paid') {
        status = 'settlement';
        paidAt = body.paid_at ? new Date(body.paid_at) : new Date();
      } else if (xenditStatus === 'expired') {
        status = 'expire';
      } else if (xenditStatus === 'pending') {
        status = 'pending';
      } else {
        status = xenditStatus;
      }
      
      // Verify Xendit callback token
      const gatewayConfig = await prisma.paymentGateway.findUnique({
        where: { provider: 'xendit' }
      });
      
      if (gatewayConfig?.xenditWebhookToken && gatewayConfig.xenditWebhookToken.trim() !== '') {
        if (signature && signature !== gatewayConfig.xenditWebhookToken) {
          console.error('[Xendit] Invalid webhook token');
          return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
      }
      
      console.log('[Xendit] Webhook processed');
    }
    // XENDIT FVA (Fixed Virtual Account) Detection
    else if (payload.payment_id && payload.external_id && payload.bank_code) {
      gateway = 'xendit';
      orderId = payload.external_id;
      transactionId = payload.payment_id || payload.id || '';
      paymentType = `va_${payload.bank_code}`;
      amount = payload.amount ? parseInt(payload.amount) : undefined;
      
      // FVA callback means payment is successful
      status = 'settlement';
      paidAt = payload.transaction_timestamp ? new Date(payload.transaction_timestamp) : new Date();
      
      // Verify Xendit callback token
      const gatewayConfig = await prisma.paymentGateway.findUnique({
        where: { provider: 'xendit' }
      });
      
      if (gatewayConfig?.xenditWebhookToken && gatewayConfig.xenditWebhookToken.trim() !== '') {
        if (signature && signature !== gatewayConfig.xenditWebhookToken) {
          console.error('[Xendit FVA] Invalid webhook token');
          return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
      }
      
      console.log('[Xendit FVA] Webhook processed');
    }
    // DUITKU Detection
    else if (payload.merchantOrderId && payload.resultCode) {
      gateway = 'duitku';
      orderId = payload.merchantOrderId;
      transactionId = payload.reference || '';
      paymentType = payload.paymentMethod || '';
      amount = payload.amount ? parseInt(payload.amount) : undefined;
      
      const duitkuStatus = payload.resultCode;
      
      // Map Duitku status
      if (duitkuStatus === '00') {
        status = 'settlement';
        paidAt = new Date();
      } else if (duitkuStatus === '01') {
        status = 'pending';
      } else {
        status = 'failed';
      }
      
      // Verify Duitku signature
      const gatewayConfig = await prisma.paymentGateway.findUnique({
        where: { provider: 'duitku' }
      });
      
      if (gatewayConfig?.duitkuApiKey) {
        const receivedSignature = payload.signature;
        // Formula: MD5(merchantCode + amount + merchantOrderId + apiKey)
        const expectedSignature = crypto
          .createHash('md5')
          .update(`${gatewayConfig.duitkuMerchantCode}${payload.amount}${orderId}${gatewayConfig.duitkuApiKey}`)
          .digest('hex');
        
        if (receivedSignature !== expectedSignature) {
          console.error('[Duitku] Invalid signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
      
      console.log('[Duitku] Webhook processed');
    }
    else {
      console.error('Unknown webhook payload format');
      return NextResponse.json({ error: 'Unknown webhook provider' }, { status: 400 });
    }
    
    console.log(`Processing: ${gateway.toUpperCase()} | Order: ${orderId} | Status: ${status}`);
    
    // Find existing log for this order or create new
    const existingLog = await prisma.webhookLog.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (existingLog) {
      // Update existing log
      const webhookLog = await prisma.webhookLog.update({
        where: { id: existingLog.id },
        data: {
          gateway,
          status,
          transactionId,
          amount,
          payload: JSON.stringify(body),
          success: true
        }
      });
      webhookLogId = webhookLog.id;
      console.log(`✅ Updated existing webhook log for ${orderId}`);
    } else {
      // Create new log
      const webhookLog = await prisma.webhookLog.create({
        data: {
          id: crypto.randomUUID(),
          gateway,
          orderId,
          status,
          transactionId,
          amount,
          payload: JSON.stringify(body),
          success: true
        }
      });
      webhookLogId = webhookLog.id;
      console.log(`✅ Created new webhook log for ${orderId}`);
    }
    
    // ============================================
    // DETECT ORDER TYPE (Invoice or Voucher Order)
    // ============================================
    
    // Check if this is a voucher order (EVC-) or invoice (INV-)
    if (orderId.startsWith('EVC-')) {
      // Handle E-Voucher Order
      await handleVoucherOrder(orderId, status, gateway, paymentType, paidAt);
    } else {
      // Handle PPPoE Invoice
      await handleInvoicePayment(orderId, status, gateway, paymentType, paidAt);
    }
    
    // Update webhook log with success response
    if (webhookLogId) {
      await prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          response: JSON.stringify({ success: true, gateway, status, orderId })
        }
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      gateway, 
      status,
      orderId,
      message: 'Webhook processed successfully'
    });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    // Log the error in webhook log
    if (webhookLogId) {
      try {
        await prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            response: JSON.stringify({ error: 'Webhook processing failed' })
          }
        });
      } catch (logError) {
        console.error('Failed to update webhook log:', logError);
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// ============================================
// HANDLE VOUCHER ORDER PAYMENT
// ============================================
async function handleVoucherOrder(
  orderId: string,
  status: string,
  gateway: string,
  paymentType: string,
  paidAt: Date | null
) {
  // Extract order number from orderId
  // Format bisa: EVC-20251028-0001 atau EVC-20251028-0001-timestamp
  let orderNumber = orderId;
  
  // Jika ada timestamp, ambil 3 bagian pertama
  const parts = orderId.split('-');
  if (parts.length > 3) {
    orderNumber = parts.slice(0, 3).join('-'); // EVC-20251028-0001
  }
  
  console.log(`Looking for voucher order: ${orderNumber} (from orderId: ${orderId})`);
  
  const order = await prisma.voucherOrder.findFirst({
    where: { orderNumber },
    include: {
      profile: true
    }
  });
  
  if (!order) {
    console.error(`❌ Voucher order not found: ${orderNumber}`);
    console.error(`Original orderId: ${orderId}`);
    
    // Try to find by partial match as fallback
    const allOrders = await prisma.voucherOrder.findMany({
      where: {
        orderNumber: {
          contains: parts[0] + '-' + parts[1] // EVC-20251028
        }
      },
      select: { orderNumber: true, status: true }
    });
    
    console.log(`Found similar orders:`, allOrders);
    throw new Error(`Voucher order not found: ${orderNumber}`);
  }
  
  console.log(`✅ Voucher order found: ${order.orderNumber}`);
  
  if (status === 'settlement' || status === 'capture') {
    if (order.status !== 'PAID') {
      // Update order to PAID
      await prisma.voucherOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt: paidAt || new Date()
        }
      });
      
      console.log(`✅ Order ${order.orderNumber} marked as PAID`);
      
      // ============================================
      // AUTO-GENERATE VOUCHERS
      // ============================================
      
      const vouchers = [];
      for (let i = 0; i < order.quantity; i++) {
        // Generate unique voucher code
        let voucherCode = '';
        let isUnique = false;
        
        while (!isUnique) {
          voucherCode = generateVoucherCode(8);
          const existing = await prisma.hotspotVoucher.findUnique({
            where: { code: voucherCode }
          });
          if (!existing) {
            isUnique = true;
          }
        }
        
        // Create voucher
        const voucher = await prisma.hotspotVoucher.create({
          data: {
            id: crypto.randomUUID(),
            code: voucherCode,
            batchCode: order.orderNumber,
            profileId: order.profileId,
            orderId: order.id,
            status: 'WAITING'
          }
        });
        
        vouchers.push(voucher);
        
        // Sync to RADIUS using proper sync function
        try {
          await syncVoucherToRadius(voucher.id);
          console.log(`✅ Voucher ${voucherCode} synced to RADIUS`);
        } catch (radiusError) {
          console.error(`RADIUS sync error for ${voucherCode}:`, radiusError);
        }
      }
      
      console.log(`✅ Generated ${vouchers.length} vouchers for order ${order.orderNumber}`);
      
      // ============================================
      // AUTO-SYNC TO KEUANGAN TRANSACTIONS
      // ============================================
      try {
        const hotspotCategory = await prisma.transactionCategory.findFirst({
          where: { name: 'Pembayaran Hotspot', type: 'INCOME' },
        });

        if (hotspotCategory) {
          // Check if transaction already exists
          const existingTransaction = await prisma.transaction.findFirst({
            where: { reference: order.orderNumber },
          });

          if (!existingTransaction) {
            await prisma.transaction.create({
              data: {
                id: nanoid(),
                categoryId: hotspotCategory.id,
                type: 'INCOME',
                amount: order.totalAmount,
                description: `Voucher ${order.profile.name} (${order.quantity}x) - ${order.customerName}`,
                date: paidAt || new Date(),
                reference: order.orderNumber,
                notes: `Auto-synced from voucher order payment`,
              },
            });
            console.log(`✅ Transaction synced to Keuangan: ${order.orderNumber}`);
          }
        }
      } catch (keuanganError) {
        console.error('Keuangan sync error:', keuanganError);
      }
      
      // Send WhatsApp notification with voucher codes
      try {
        await sendVoucherPurchaseSuccess({
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          orderNumber: order.orderNumber,
          profileName: order.profile.name,
          quantity: order.quantity,
          voucherCodes: vouchers.map(v => v.code),
          validityValue: order.profile.validityValue,
          validityUnit: order.profile.validityUnit,
        });
        console.log(`✅ WhatsApp voucher notification sent to ${order.customerPhone}`);
      } catch (waError) {
        console.error('WhatsApp voucher notification error:', waError);
      }
    }
  }
}

// Generate random voucher code
function generateVoucherCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// HANDLE INVOICE PAYMENT (PPPOE)
// ============================================
async function handleInvoicePayment(
  orderId: string,
  status: string,
  gateway: string,
  paymentType: string,
  paidAt: Date | null
) {
  // Order ID format: INV-{invoiceNumber}-{timestamp}
  // Support multiple formats:
  // - INV-{invoiceNumber}-{timestamp}
  // - {invoiceNumber}
  const parts = orderId.split('-');
  const invoiceNumber = orderId.startsWith('INV-') && parts.length >= 3
    ? parts.slice(1, -1).join('-')
    : orderId;
  
  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber },
    include: {
      user: {
        include: {
          profile: true
        }
      }
    }
  });
  
  if (!invoice) {
    console.error('Invoice not found for order:', orderId, 'invoiceNumber:', invoiceNumber);
    // Gracefully ignore unknown payments (e.g., fixed-payment-code) to avoid retries
    return;
  }
  
  console.log(`✅ Invoice found: ${invoice.invoiceNumber}`);
  
  if (status === 'settlement' || status === 'capture') {
      if (invoice.status !== 'PAID') {
        // Update invoice to PAID
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAID',
            paidAt: paidAt || new Date()
          }
        });
        
        // Check if payment already exists (idempotency)
        const existingPayment = await prisma.payment.findFirst({
          where: { invoiceId: invoice.id }
        });
        
        // Create payment record only if not exists
        if (!existingPayment) {
          await prisma.payment.create({
            data: {
              id: crypto.randomUUID(),
              invoiceId: invoice.id,
              amount: invoice.amount,
              method: `${gateway}_${paymentType}`,
              status: 'completed',
              paidAt: paidAt || new Date()
            }
          });
          console.log(`✅ Payment record created for invoice ${invoice.invoiceNumber}`);
        } else {
          console.log(`⚠️ Payment already exists for invoice ${invoice.invoiceNumber}, skipping duplicate`);
        }
        
        console.log(`✅ Invoice ${invoice.invoiceNumber} marked as PAID`);
        
        // ============================================
        // AUTO-SYNC TO KEUANGAN TRANSACTIONS
        // ============================================
        try {
          const pppoeCategory = await prisma.transactionCategory.findFirst({
            where: { name: 'Pembayaran PPPoE', type: 'INCOME' },
          });

          if (pppoeCategory) {
            const user = invoice.user;
            // Check if transaction already exists
            const existingTransaction = await prisma.transaction.findFirst({
              where: { reference: `INV-${invoice.invoiceNumber}` },
            });

            if (!existingTransaction) {
              const customerName = invoice.customerName || user?.name || 'Unknown';
              const profileName = user?.profile?.name || 'Unknown';

              // Use raw SQL with NOW() to avoid timezone conversion
              await prisma.$executeRaw`
                INSERT INTO transactions (id, categoryId, type, amount, description, date, reference, notes, createdAt, updatedAt)
                VALUES (${nanoid()}, ${pppoeCategory.id}, 'INCOME', ${invoice.amount}, 
                        ${`Pembayaran ${profileName} - ${customerName}`}, NOW(), 
                        ${`INV-${invoice.invoiceNumber}`}, 
                        ${`Payment via ${gateway} (${paymentType})`}, NOW(), NOW())
              `;
              console.log(`✅ Transaction synced to Keuangan: ${invoice.invoiceNumber} (Rp ${invoice.amount})`);
            } else {
              console.log(`⏭️  Transaction already exists for: ${invoice.invoiceNumber}`);
            }
          }
        } catch (keuanganError) {
          console.error('Keuangan sync error:', keuanganError);
        }
        
        // ============================================
        // ACTIVATE USER & EXTEND EXPIRY
        // ============================================
        
        const user = invoice.user;
        
        if (user && user.profile) {
          const profile = user.profile;
          const now = new Date();
          
          // Use current expiredAt as base, or now if not set
          let baseDate = user.expiredAt ? new Date(user.expiredAt) : now;
          
          // If already expired, use now as base
          if (baseDate < now) {
            baseDate = now;
          }
          
          // Calculate new expiry date
          let newExpiredAt = new Date(baseDate);
          
          switch (profile.validityUnit) {
            case 'DAYS':
              newExpiredAt.setDate(newExpiredAt.getDate() + profile.validityValue);
              break;
            case 'MONTHS':
              newExpiredAt.setMonth(newExpiredAt.getMonth() + profile.validityValue);
              break;
            case 'HOURS':
              newExpiredAt.setHours(newExpiredAt.getHours() + profile.validityValue);
              break;
            case 'MINUTES':
              newExpiredAt.setMinutes(newExpiredAt.getMinutes() + profile.validityValue);
              break;
          }
          
          // Determine if user should be activated
          const wasIsolatedOrSuspended = user.status === 'isolated' || user.status === 'suspended';
          const newStatus = wasIsolatedOrSuspended ? 'active' : user.status;
          
          // Update user
          await prisma.pppoeUser.update({
            where: { id: user.id },
            data: {
              expiredAt: newExpiredAt,
              status: newStatus
            }
          });
          
          console.log(`✅ User ${user.username} updated:`);
          console.log(`   - Expiry: ${user.expiredAt?.toISOString() || 'N/A'} → ${newExpiredAt.toISOString()}`);
          
          // ============================================
          // SEND WHATSAPP NOTIFICATION (ALWAYS)
          // ============================================
          try {
            await sendPaymentSuccess({
              customerName: user.name,
              customerPhone: user.phone,
              username: user.username,
              password: user.password,
              profileName: profile.name,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
            });
            console.log(`✅ WhatsApp payment success notification sent`);
          } catch (waError) {
            console.error('WhatsApp notification error:', waError);
          }
          
          if (wasIsolatedOrSuspended) {
            console.log(`   - Status: ${user.status} → ${newStatus}`);
            
            // ============================================
            // RADIUS SYNC FOR REACTIVATION
            // ============================================
            
            try {
              // 1. Restore radcheck (username + password)
              await prisma.$executeRaw`
                INSERT INTO radcheck (username, attribute, op, value)
                VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
                ON DUPLICATE KEY UPDATE value = ${user.password}
              `;
              
              // 2. Restore radusergroup
              await prisma.$executeRaw`
                INSERT INTO radusergroup (username, groupname, priority)
                VALUES (${user.username}, ${profile.groupName}, 0)
                ON DUPLICATE KEY UPDATE groupname = ${profile.groupName}
              `;
              
              // 3. Remove isolated message from radreply
              await prisma.radreply.deleteMany({
                where: {
                  username: user.username,
                  attribute: 'Reply-Message'
                }
              });
              console.log(`✅ Removed isolated message from radreply for ${user.username}`);
              
              // 4. Restore radreply (if static IP)
              if (user.ipAddress) {
                await prisma.$executeRaw`
                  INSERT INTO radreply (username, attribute, op, value)
                  VALUES (${user.username}, 'Framed-IP-Address', ':=', ${user.ipAddress})
                  ON DUPLICATE KEY UPDATE value = ${user.ipAddress}
                `;
              }
              
              console.log(`✅ RADIUS entries restored for ${user.username}`);
              
              // Update registration status to ACTIVE if this is installation invoice
              const registration = await prisma.registrationRequest.findFirst({
                where: {
                  pppoeUserId: user.id,
                  status: 'INSTALLED'
                }
              });
              
              if (registration) {
                await prisma.registrationRequest.update({
                  where: { id: registration.id },
                  data: { status: 'ACTIVE' }
                });
                console.log(`✅ Registration ${registration.id} status updated to ACTIVE`);
              }
              
              // 5. Send CoA Disconnect to force re-authentication
              if (user.routerId) {
                try {
                  // Get base URL from company settings
                  const company = await prisma.company.findFirst();
                  const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL;
                  
                  if (baseUrl) {
                    const coaRes = await fetch(`${baseUrl}/api/coa/disconnect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user.username })
                  });
                  
                  if (coaRes.ok) {
                    console.log(`✅ CoA disconnect sent for ${user.username}`);
                  }
                }
                } catch (coaError) {
                  console.error('CoA disconnect failed:', coaError);
                }
              }
            } catch (radiusError) {
              console.error('RADIUS sync error:', radiusError);
            }
          }
        }
      }
    }
}
