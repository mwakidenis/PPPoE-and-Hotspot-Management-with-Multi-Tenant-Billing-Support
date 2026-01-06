import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Generate secure random token for payment link
function generatePaymentToken(): string {
  return randomBytes(32).toString('hex');
}

// POST - Generate invoices for users expiring in next 7 days
export async function POST(request: NextRequest) {
  try {
    // Calculate date range: today to +7 days
    const now = new Date();
    const startDate = new Date(now); // Today 00:00:00
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now); // +7 days 23:59:59
    endDate.setDate(endDate.getDate() + 7);
    endDate.setHours(23, 59, 59, 999);

    console.log(`[Invoice Generate] Checking users expiring between:`);
    console.log(`  Start: ${startDate.toISOString()}`);
    console.log(`  End: ${endDate.toISOString()}`);

    // Get active PPPoE users with expiredAt in next 7 days
    const users = await prisma.pppoeUser.findMany({
      where: {
        status: 'active',
        expiredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        profile: true,
      },
    });

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users expiring in next 7 days',
        generated: 0,
        skipped: 0,
      });
    }

    console.log(`[Invoice Generate] Found ${users.length} users expiring in next 7 days`);

    // Get current month/year for invoice numbering
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Get existing invoice count for this month
    let invoiceCount = await prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: `INV-${year}${month}-`,
        },
      },
    });

    let generated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Get company base URL for payment links
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || 'http://localhost:3000';

    for (const user of users) {
      try {
        // Check if user already has unpaid invoice (any time)
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            userId: user.id,
            status: {
              in: ['PENDING', 'OVERDUE'],
            },
          },
        });

        if (existingInvoice) {
          skipped++;
          console.log(`⏭️  Skipped ${user.username} - Already has unpaid invoice (${existingInvoice.invoiceNumber})`);
          continue;
        }

        // Get amount from profile
        if (!user.profile) {
          skipped++;
          console.log(`⏭️  Skipped ${user.username} - No profile assigned`);
          continue;
        }

        const amount = user.profile.price;

        // Use user's expiredAt as invoice dueDate (no grace period)
        if (!user.expiredAt) {
          skipped++;
          console.log(`⏭️  Skipped ${user.username} - No expiredAt set`);
          continue;
        }

        // Generate invoice number
        invoiceCount++;
        const invoiceNumber = `INV-${year}${month}-${String(invoiceCount).padStart(4, '0')}`;

        // Generate payment token and link
        const paymentToken = generatePaymentToken();
        const paymentLink = `${baseUrl}/pay/${paymentToken}`;

        // Create invoice with customer snapshot
        await prisma.invoice.create({
          data: {
            id: crypto.randomUUID(),
            invoiceNumber,
            userId: user.id,
            customerName: user.name,
            customerPhone: user.phone,
            customerUsername: user.username,
            amount,
            dueDate: user.expiredAt,
            status: 'PENDING',
            paymentToken,
            paymentLink,
          },
        });

        generated++;
        const expiredAtStr = user.expiredAt ? new Date(user.expiredAt).toLocaleDateString('id-ID') : 'N/A';
        console.log(`✅ Generated invoice ${invoiceNumber} for ${user.username} - ${amount} (expires: ${expiredAtStr})`);
      } catch (error: any) {
        errors.push(`${user.username}: ${error.message}`);
        console.error(`❌ Error generating invoice for ${user.username}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${generated} invoices, skipped ${skipped} users`,
      generated,
      skipped,
      total: users.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Generate invoices error:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoices', details: (error as Error).message },
      { status: 500 }
    );
  }
}
