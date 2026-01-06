import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Get agent sales history grouped by month
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    // Get all sales for the agent
    const sales = await prisma.agentSale.findMany({
      where: {
        agentId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (month && year) {
      // Get specific month sales
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      const monthSales = sales.filter((sale) => {
        const saleDate = new Date(sale.createdAt);
        return (
          saleDate.getMonth() === monthNum &&
          saleDate.getFullYear() === yearNum
        );
      });

      const total = monthSales.reduce((sum, sale) => sum + sale.amount, 0);

      return NextResponse.json({
        month: monthNum,
        year: yearNum,
        total,
        count: monthSales.length,
        sales: monthSales,
      });
    }

    // Group sales by month
    const groupedByMonth: Record<string, any[]> = {};

    sales.forEach((sale) => {
      const saleDate = new Date(sale.createdAt);
      const key = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!groupedByMonth[key]) {
        groupedByMonth[key] = [];
      }
      groupedByMonth[key].push(sale);
    });

    // Calculate totals for each month
    const monthlyStats = Object.entries(groupedByMonth).map(([key, sales]) => {
      const [year, month] = key.split('-');
      const total = sales.reduce((sum, sale) => sum + sale.amount, 0);

      return {
        year: parseInt(year),
        month: parseInt(month),
        monthName: new Date(parseInt(year), parseInt(month) - 1).toLocaleString('id-ID', {
          month: 'long',
          year: 'numeric',
        }),
        total,
        count: sales.length,
      };
    });

    // Sort by year and month descending
    monthlyStats.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    return NextResponse.json({
      history: monthlyStats,
    });
  } catch (error) {
    console.error('Get agent history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
