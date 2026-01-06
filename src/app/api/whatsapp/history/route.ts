import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { message: { contains: search } },
      ];
    }

    // Get total count
    const total = await prisma.whatsapp_history.count({ where });

    // Get history records
    const history = await prisma.whatsapp_history.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
    });

    // Get provider stats (count per provider from last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const recentStats = await prisma.whatsapp_history.groupBy({
      by: ['status'],
      where: {
        sentAt: { gte: last24Hours },
      },
      _count: true,
    });

    const stats = {
      total: await prisma.whatsapp_history.count(),
      sent: recentStats.find(s => s.status === 'sent')?._count || 0,
      failed: recentStats.find(s => s.status === 'failed')?._count || 0,
      last24Hours: recentStats.reduce((sum, s) => sum + s._count, 0),
    };

    return NextResponse.json({
      success: true,
      data: history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error: any) {
    console.error('History API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
