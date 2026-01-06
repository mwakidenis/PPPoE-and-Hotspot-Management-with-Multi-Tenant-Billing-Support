import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payment-gateway/webhook-logs
 * Fetch webhook logs with pagination and filters
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const gateway = searchParams.get('gateway');
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');
    const successFilter = searchParams.get('success');
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {};
    if (gateway) where.gateway = gateway;
    if (orderId) where.orderId = { contains: orderId };
    if (status) where.status = status;
    if (successFilter !== null && successFilter !== undefined) {
      where.success = successFilter === 'true';
    }
    
    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          gateway: true,
          orderId: true,
          status: true,
          transactionId: true,
          amount: true,
          success: true,
          errorMessage: true,
          createdAt: true,
          payload: true,
          response: true
        }
      }),
      prisma.webhookLog.count({ where })
    ]);
    
    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch webhook logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook logs' },
      { status: 500 }
    );
  }
}
