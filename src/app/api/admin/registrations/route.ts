import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const registrations = await prisma.registrationRequest.findMany({
      where,
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            price: true,
            downloadSpeed: true,
            uploadSpeed: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amount: true,
          },
        },
        pppoeUser: {
          select: {
            id: true,
            username: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Count by status
    const statusCounts = await prisma.registrationRequest.groupBy({
      by: ['status'],
      _count: true,
    });

    const stats = {
      total: registrations.length,
      pending: statusCounts.find((s) => s.status === 'PENDING')?._count || 0,
      approved: statusCounts.find((s) => s.status === 'APPROVED')?._count || 0,
      installed: statusCounts.find((s) => s.status === 'INSTALLED')?._count || 0,
      active: statusCounts.find((s) => s.status === 'ACTIVE')?._count || 0,
      rejected: statusCounts.find((s) => s.status === 'REJECTED')?._count || 0,
    };

    return NextResponse.json({
      registrations,
      stats,
    });
  } catch (error: any) {
    console.error('Get registrations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}
