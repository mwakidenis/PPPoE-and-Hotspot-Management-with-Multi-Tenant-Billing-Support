import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type') || 'sessions';
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get user to verify and get username
    const user = await prisma.pppoeUser.findUnique({
      where: { id },
      select: { username: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (type === 'sessions') {
      // Get session history from radacct
      const sessions = await prisma.radacct.findMany({
        where: {
          username: user.username,
        },
        orderBy: {
          acctstarttime: 'desc',
        },
        take: limit,
        select: {
          radacctid: true,
          acctsessionid: true,
          acctstarttime: true,
          acctstoptime: true,
          acctsessiontime: true,
          acctinputoctets: true,
          acctoutputoctets: true,
          nasipaddress: true,
          acctterminatecause: true,
          callingstationid: true, // MAC address (client)
        },
      });

      // Format sessions
      const formattedSessions = sessions.map((session) => {
        const download = Number(session.acctinputoctets || 0);
        const upload = Number(session.acctoutputoctets || 0);
        const total = download + upload;

        const formatBytes = (bytes: number) => {
          if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
          if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
          if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
          return `${bytes} B`;
        };

        const formatDuration = (seconds: number | null) => {
          if (!seconds) return '-';
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;
          return `${hours}h ${minutes}m ${secs}s`;
        };

        return {
          id: session.radacctid.toString(),
          sessionId: session.acctsessionid,
          startTime: session.acctstarttime,
          stopTime: session.acctstoptime,
          duration: session.acctsessiontime,
          durationFormatted: formatDuration(session.acctsessiontime),
          download: formatBytes(download),
          upload: formatBytes(upload),
          total: formatBytes(total),
          nasIp: session.nasipaddress,
          terminateCause: session.acctterminatecause,
          macAddress: session.callingstationid || '-',
          isOnline: !session.acctstoptime,
        };
      });

      return NextResponse.json({
        success: true,
        data: formattedSessions,
      });
    } else if (type === 'auth') {
      // Get auth logs from radpostauth
      const authLogs = await prisma.radpostauth.findMany({
        where: {
          username: user.username,
        },
        orderBy: {
          authdate: 'desc',
        },
        take: limit,
        select: {
          id: true,
          username: true,
          reply: true,
          authdate: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: authLogs.map((log) => ({
          id: log.id,
          username: log.username,
          reply: log.reply,
          authdate: log.authdate,
          success: log.reply === 'Access-Accept',
        })),
      });
    } else if (type === 'invoices') {
      // Get user invoices
      const invoices = await prisma.invoice.findMany({
        where: {
          userId: id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          status: true,
          dueDate: true,
          paidAt: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: invoices,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid type parameter' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('User activity fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
