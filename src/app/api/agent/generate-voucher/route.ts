import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { syncBatchToRadius } from '@/lib/hotspot-radius-sync';

const prisma = new PrismaClient();

// POST - Generate voucher by agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, profileId, quantity = 1 } = body;

    if (!agentId || !profileId) {
      return NextResponse.json(
        { error: 'Agent ID and Profile ID are required' },
        { status: 400 }
      );
    }

    // Verify agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent || !agent.isActive) {
      return NextResponse.json(
        { error: 'Agent not found or inactive' },
        { status: 403 }
      );
    }

    // Verify profile and check agentAccess
    const profile = await prisma.hotspotProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.agentAccess) {
      return NextResponse.json(
        { error: 'This profile is not available for agents' },
        { status: 403 }
      );
    }

    // Generate batch code: AGENTNAME-TIMESTAMP
    const batchCode = `${agent.name.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Date.now()}`;
    
    // Generate vouchers
    const vouchers = [];

    for (let i = 0; i < quantity; i++) {
      // Generate unique code
      const code = generateVoucherCode();

      // Create voucher with batch code
      const voucher = await prisma.hotspotVoucher.create({
        data: {
          id: crypto.randomUUID(),
          code,
          profileId: profile.id,
          batchCode: batchCode,
          status: 'WAITING',
        },
      });

      vouchers.push(voucher);
    }

    // Agent pays costPrice (not sellingPrice)
    // Sales will be recorded when voucher becomes ACTIVE

    // Auto-sync to RADIUS (same as admin)
    try {
      const syncResult = await syncBatchToRadius(batchCode);
      console.log(`Agent vouchers synced: ${syncResult.successCount}/${syncResult.total} to RADIUS`);
    } catch (syncError) {
      console.error('RADIUS sync error:', syncError);
      // Don't fail the request if sync fails
    }

    return NextResponse.json({
      success: true,
      vouchers,
      batchCode,
      total: profile.costPrice * quantity, // Agent buys at cost price
      message: `${vouchers.length} vouchers generated and synced to RADIUS`,
    });
  } catch (error) {
    console.error('Generate voucher error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
