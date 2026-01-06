import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/agent/record-sales
 * Record agent sales for vouchers that became ACTIVE
 * Should be called by cron job or after voucher activation
 */
export async function POST(request: NextRequest) {
  try {
    // Get all ACTIVE vouchers that have agent batch codes (contains hyphen pattern)
    const activeVouchers = await prisma.hotspotVoucher.findMany({
      where: {
        status: 'ACTIVE',
        batchCode: {
          not: null,
        },
        firstLoginAt: {
          not: null,
        },
      },
      include: {
        profile: true,
      },
    });

    let recordedCount = 0;
    const errors = [];

    for (const voucher of activeVouchers) {
      // Skip if batch code doesn't look like agent format (no hyphen)
      if (!voucher.batchCode?.includes('-')) {
        continue;
      }

      // Check if sale already recorded
      const existingSale = await prisma.agentSale.findFirst({
        where: {
          voucherCode: voucher.code,
        },
      });

      if (existingSale) {
        continue; // Already recorded
      }

      // Extract agent name from batch code (format: AGENTNAME-TIMESTAMP)
      const agentNamePattern = voucher.batchCode.split('-')[0];

      // Find agent by matching name pattern (case-insensitive for MySQL)
      const agent = await prisma.agent.findFirst({
        where: {
          name: {
            equals: agentNamePattern,
          },
        },
      });

      if (!agent) {
        errors.push({
          voucher: voucher.code,
          error: `Agent not found for batch: ${voucher.batchCode}`,
        });
        continue;
      }

      try {
        // Record sale with resellerFee as agent profit
        await prisma.agentSale.create({
          data: {
            id: crypto.randomUUID(),
            agentId: agent.id,
            voucherCode: voucher.code,
            profileName: voucher.profile.name,
            amount: voucher.profile.resellerFee, // Agent earns resellerFee
            createdAt: voucher.firstLoginAt!, // Use first login time as sale time
          },
        });

        recordedCount++;
      } catch (error: any) {
        errors.push({
          voucher: voucher.code,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      recorded: recordedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Recorded ${recordedCount} agent sales`,
    });
  } catch (error) {
    console.error('Record agent sales error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
