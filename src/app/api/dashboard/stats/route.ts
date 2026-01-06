import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { nowWIB, startOfDayWIBtoUTC, endOfDayWIBtoUTC } from "@/lib/timezone";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Disable caching for this route - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow all authenticated admin users (they use AdminRole: SUPER_ADMIN, FINANCE, etc.)
    // No additional role check needed - if they can login to admin, they can see dashboard
    const userRole = (session.user as any).role;
    console.log('Dashboard stats accessed by role:', userRole);
    // Get current time in WIB timezone (database stores UTC)
    // Use WIB for month boundaries to match user expectations
    const now = nowWIB();
    
    // Calculate month boundaries in WIB, convert to UTC for database queries
    const startOfMonth = startOfDayWIBtoUTC(new Date(now.getFullYear(), now.getMonth(), 1));
    const startOfLastMonth = startOfDayWIBtoUTC(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const endOfLastMonth = endOfDayWIBtoUTC(new Date(now.getFullYear(), now.getMonth(), 0));

    // Total users
    const totalUsers = await prisma.pppoeUser.count();
    const lastMonthUsers = await prisma.pppoeUser.count({
      where: {
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });
    const usersGrowth =
      lastMonthUsers > 0
        ? ((totalUsers - lastMonthUsers) / lastMonthUsers) * 100
        : 0;

    // Active sessions (currently online from radacct) - with zombie detection
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeSessions = await prisma.radacct.count({
      where: {
        AND: [
          { acctstoptime: null }, // Only sessions without stop time
          {
            OR: [
              // PPPoE sessions: must have recent interim update (< 10 min)
              { acctupdatetime: { gte: tenMinutesAgo } },
              // Hotspot vouchers: might not have interim updates, so use longer window
              {
                AND: [
                  { acctupdatetime: null }, // No interim update
                  { acctstarttime: { gte: oneDayAgo } }, // Started within last 24 hours
                ],
              },
            ],
          },
        ],
      },
    });

    // Pending invoices
    const pendingInvoices = await prisma.invoice.count({
      where: {
        status: "PENDING",
      },
    });

    // Overdue invoices count for last month comparison
    const lastMonthPendingInvoices = await prisma.invoice.count({
      where: {
        status: "PENDING",
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });
    const invoicesChange =
      lastMonthPendingInvoices > 0
        ? ((pendingInvoices - lastMonthPendingInvoices) /
            lastMonthPendingInvoices) *
          100
        : 0;

    // Revenue this month (Keuangan - Transactions INCOME)
    // Query using UTC date range (database stores UTC)
    const incomeThisMonth = await prisma.transaction.aggregate({
      where: {
        type: 'INCOME',
        date: {
          gte: startOfMonth,
          lte: now,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Revenue last month - use Prisma aggregate
    const incomeLastMonth = await prisma.transaction.aggregate({
      where: {
        type: 'INCOME',
        date: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const revenueThisMonth = Number(incomeThisMonth._sum.amount) || 0;
    const revenueLastMonth = Number(incomeLastMonth._sum.amount) || 0;
    const revenueGrowth =
      revenueLastMonth > 0
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
        : 0;

    // Format revenue to IDR
    const formatRevenue = (amount: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    // Network stats
    const pppoeActiveCount = await prisma.pppoeUser.count({
      where: {
        status: "active",
      },
    });

    // Hotspot active vouchers (ACTIVE status)
    const hotspotActiveCount = await prisma.hotspotVoucher.count({
      where: {
        status: "ACTIVE",
      },
    });

    // Bandwidth usage from radacct (all time)
    const bandwidthData = await prisma.radacct.aggregate({
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
      },
    });

    const totalBytesIn = bandwidthData._sum.acctinputoctets || BigInt(0);
    const totalBytesOut = bandwidthData._sum.acctoutputoctets || BigInt(0);
    const totalBytes = Number(totalBytesIn) + Number(totalBytesOut);

    // Format bytes to readable format
    const formatBandwidth = (bytes: number) => {
      const tb = bytes / 1024 ** 4;
      const gb = bytes / 1024 ** 3;

      if (tb >= 1) {
        return `${tb.toFixed(2)} TB`;
      } else if (gb >= 1) {
        return `${gb.toFixed(2)} GB`;
      } else {
        return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
      }
    };

    // Recent activities - last 5 events
    const recentPayments = await prisma.payment.findMany({
      take: 3,
      orderBy: {
        paidAt: "desc",
      },
      include: {
        invoice: {
          select: {
            customerUsername: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });

    const recentInvoices = await prisma.invoice.findMany({
      where: {
        status: "PENDING",
        dueDate: {
          lt: now,
        },
      },
      take: 2,
      orderBy: {
        dueDate: "desc",
      },
      select: {
        customerUsername: true,
        dueDate: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    // Format activities
    const activities = [
      ...recentPayments.map((payment) => ({
        id: payment.id,
        user:
          payment.invoice.user?.username ||
          payment.invoice.customerUsername ||
          "Unknown",
        action: "Payment received",
        time: payment.paidAt.toISOString(),
        status: "success" as const,
      })),
      ...recentInvoices.map((invoice) => ({
        id: invoice.customerUsername || "unknown",
        user: invoice.user?.username || invoice.customerUsername || "Unknown",
        action: "Invoice overdue",
        time: invoice.dueDate.toISOString(),
        status: "warning" as const,
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);

    // System status checks
    let radiusStatus = false;
    let databaseStatus = true; // If we got here, database is connected
    let apiStatus = true; // If we got here, API is running

    // Check RADIUS by checking if radacct table has recent records
    try {
      const recentRadacct = await prisma.radacct.findFirst({
        where: {
          acctstarttime: {
            gte: new Date(Date.now() - 3600000), // Last 1 hour
          },
        },
      });
      radiusStatus = !!recentRadacct;
    } catch (error) {
      radiusStatus = false;
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: {
          value: totalUsers,
          change: `${usersGrowth > 0 ? "+" : ""}${usersGrowth.toFixed(1)}%`,
        },
        activeSessions: {
          value: activeSessions,
          change: null, // Can calculate if needed
        },
        pendingInvoices: {
          value: pendingInvoices,
          change: `${invoicesChange > 0 ? "+" : ""}${invoicesChange.toFixed(1)}%`,
        },
        revenue: {
          value: formatRevenue(revenueThisMonth),
          change: `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`,
        },
      },
      network: {
        pppoeUsers: pppoeActiveCount,
        hotspotSessions: hotspotActiveCount,
        bandwidth: formatBandwidth(totalBytes),
      },
      activities,
      systemStatus: {
        radius: radiusStatus,
        database: databaseStatus,
        api: apiStatus,
      },
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
