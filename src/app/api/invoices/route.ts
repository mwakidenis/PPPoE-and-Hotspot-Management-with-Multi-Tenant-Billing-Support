import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { disconnectPPPoEUser } from '@/lib/services/coaService';
import { sendPaymentSuccess } from '@/lib/whatsapp-notifications';
import { randomBytes } from 'crypto';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// Generate secure random token for payment link
function generatePaymentToken(): string {
  return randomBytes(32).toString('hex');
}

// GET - List invoices with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // UNPAID, PAID, PENDING, OVERDUE
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
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
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Calculate stats
    const stats = {
      total: await prisma.invoice.count(),
      unpaid: await prisma.invoice.count({ where: { status: { in: ['PENDING', 'OVERDUE'] } } }),
      paid: await prisma.invoice.count({ where: { status: 'PAID' } }),
      pending: await prisma.invoice.count({ where: { status: 'PENDING' } }),
      overdue: await prisma.invoice.count({ where: { status: 'OVERDUE' } }),
      totalUnpaidAmount: await prisma.invoice.aggregate({
        where: { status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { amount: true },
      }),
      totalPaidAmount: await prisma.invoice.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
    };

    return NextResponse.json({
      invoices,
      stats: {
        ...stats,
        totalUnpaidAmount: stats.totalUnpaidAmount._sum.amount || 0,
        totalPaidAmount: stats.totalPaidAmount._sum.amount || 0,
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// POST - Create invoice manually
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, dueDate, notes } = body;

    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'User ID and amount are required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.pppoeUser.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate invoice number: INV-YYYYMM-0001
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const count = await prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: `INV-${year}${month}-`,
        },
      },
    });
    const invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;

    // Calculate due date (default 7 days from now)
    const calculatedDueDate = dueDate
      ? new Date(dueDate)
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get company base URL for payment link
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || 'http://localhost:3000';

    // Generate payment token and link
    const paymentToken = generatePaymentToken();
    const paymentLink = `${baseUrl}/pay/${paymentToken}`;

    const invoice = await prisma.invoice.create({
      data: {
        id: crypto.randomUUID(),
        invoiceNumber,
        userId,
        customerName: user.name,
        customerPhone: user.phone,
        customerUsername: user.username,
        amount,
        dueDate: calculatedDueDate,
        status: 'PENDING',
        paymentToken,
        paymentLink,
      },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

// PUT - Update invoice (mark as paid, etc)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, paidAt } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Get existing invoice with user and profile
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const updateData: any = {};

    if (status) updateData.status = status;

    // If marking as paid, set paidAt timestamp
    if (status === 'PAID' && !paidAt) {
      updateData.paidAt = new Date();
    } else if (paidAt) {
      updateData.paidAt = new Date(paidAt);
    }

    // Update invoice
    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    // If marking as PAID, extend user's expiredAt based on profile validity
    if (status === 'PAID' && existingInvoice.status !== 'PAID') {
      const user = existingInvoice.user;
      const profile = user.profile;

      if (profile) {
        // Calculate new expiredAt - ALWAYS extend from current expiredAt
        // This keeps the billing date consistent (e.g., always on 5th of month)
        // Even if user pays late, next billing date stays on same day
        const currentExpiry = user.expiredAt || new Date();
        let newExpiry = new Date(currentExpiry);

        // Extend based on profile validity
        switch (profile.validityUnit) {
          case 'DAYS':
            newExpiry.setDate(newExpiry.getDate() + profile.validityValue);
            break;
          case 'MONTHS':
            // Keep the same day of month (e.g., 5 Nov → 5 Dec → 5 Jan)
            newExpiry.setMonth(newExpiry.getMonth() + profile.validityValue);
            break;
          case 'HOURS':
            newExpiry.setHours(newExpiry.getHours() + profile.validityValue);
            break;
          case 'MINUTES':
            newExpiry.setMinutes(newExpiry.getMinutes() + profile.validityValue);
            break;
        }

        // Update user expiredAt and activate if isolated/suspended/expired
        const shouldActivate = ['isolated', 'suspended', 'expired'].includes(user.status);

        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: {
            expiredAt: newExpiry,
            status: shouldActivate ? 'active' : user.status,
          },
        });

        console.log(`[Invoice Payment] User ${user.name}:`);
        console.log(`  - ExpiredAt: ${currentExpiry.toISOString()} → ${newExpiry.toISOString()}`);
        
        // ============================================
        // AUTO-SYNC TO KEUANGAN TRANSACTIONS
        // ============================================
        try {
          const pppoeCategory = await prisma.transactionCategory.findFirst({
            where: { name: 'Pembayaran PPPoE', type: 'INCOME' },
          });

          if (pppoeCategory) {
            // Check if transaction already exists
            const existingTransaction = await prisma.transaction.findFirst({
              where: { reference: `INV-${existingInvoice.invoiceNumber}` },
            });

            if (!existingTransaction) {
              // Use raw SQL with NOW() to avoid timezone conversion
              const paidDate = updateData.paidAt || new Date();
              await prisma.$executeRaw`
                INSERT INTO transactions (id, categoryId, type, amount, description, date, reference, notes, createdAt, updatedAt)
                VALUES (${nanoid()}, ${pppoeCategory.id}, 'INCOME', ${existingInvoice.amount}, 
                        ${`Pembayaran ${profile.name} - ${user.name}`}, NOW(), 
                        ${`INV-${existingInvoice.invoiceNumber}`}, 'Manual mark as paid by admin', NOW(), NOW())
              `;
              console.log(`  - Keuangan: Transaction synced (${existingInvoice.amount})`);
            }
          }
        } catch (keuanganError) {
          console.error('  - Keuangan sync error:', keuanganError);
        }
        
        // ============================================
        // SEND WHATSAPP NOTIFICATION (ALWAYS)
        // ============================================
        if (user.phone && profile) {
          try {
            await sendPaymentSuccess({
              customerName: user.name,
              customerPhone: user.phone,
              username: user.username,
              password: user.password,
              profileName: profile.name,
              invoiceNumber: existingInvoice.invoiceNumber,
              amount: existingInvoice.amount,
            });
            console.log(`  - WhatsApp: Payment success notification sent`);
          } catch (waError) {
            console.error(`  - WhatsApp: Failed to send notification:`, waError);
            // Don't fail the payment if WhatsApp fails
          }
        }
        
        if (shouldActivate) {
          console.log(`  - Status: ${user.status} → active`);
          
          // Restore RADIUS to active profile
          try {
            // 1. Ensure password in radcheck
            await prisma.$executeRaw`
              INSERT INTO radcheck (username, attribute, op, value)
              VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
              ON DUPLICATE KEY UPDATE value = ${user.password}
            `;

            // 2. Restore to original group
            await prisma.$executeRaw`
              DELETE FROM radusergroup WHERE username = ${user.username}
            `;
            await prisma.$executeRaw`
              INSERT INTO radusergroup (username, groupname, priority)
              VALUES (${user.username}, ${profile.groupName}, 1)
            `;

            // 3. Remove isolated message from radreply
            await prisma.radreply.deleteMany({
              where: {
                username: user.username,
                attribute: 'Reply-Message'
              }
            });
            console.log(`  - Removed isolated message from radreply`);
            
            // 4. Restore static IP if exists
            if (user.ipAddress) {
              await prisma.$executeRaw`
                INSERT INTO radreply (username, attribute, op, value)
                VALUES (${user.username}, 'Framed-IP-Address', ':=', ${user.ipAddress})
                ON DUPLICATE KEY UPDATE value = ${user.ipAddress}
              `;
            } else {
              // Remove static IP if not configured
              await prisma.$executeRaw`
                DELETE FROM radreply WHERE username = ${user.username} AND attribute = 'Framed-IP-Address'
              `;
            }
            
            console.log(`  - RADIUS: Restored to active profile (${profile.groupName})`);
            
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
              console.log(`  - Registration status updated to ACTIVE`);
            }
            
            // 5. Send CoA disconnect to force re-auth with new profile
            const coaResult = await disconnectPPPoEUser(user.username);
            if (coaResult.success) {
            console.log(`  - CoA: User disconnected, will reconnect with active profile`);
            } else {
              console.log(`  - CoA: ${coaResult.error || 'No active session'}`);
            }
          } catch (radiusError) {
            console.error(`  - RADIUS sync error:`, radiusError);
            // Don't fail the payment if RADIUS sync fails
          }
        }
      }
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}
