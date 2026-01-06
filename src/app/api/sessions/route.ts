import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper to format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'pppoe' | 'hotspot' | null
    const routerId = searchParams.get('routerId');
    const search = searchParams.get('search');

    // Calculate cutoff times for zombie detection
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // For hotspot fallback

    // Build where clause for radacct (active sessions)
    const where: any = {
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
    };

    // Add search filter without overwriting zombie filter
    if (search) {
      where.AND.push({
        OR: [
          { username: { contains: search } },
          { framedipaddress: { contains: search } },
        ],
      });
    }

    // Add router filter
    if (routerId) {
      const router = await prisma.router.findUnique({
        where: { id: routerId },
        select: { nasname: true },
      });
      if (router) {
        where.AND.push({ nasipaddress: router.nasname });
      }
    }

    // Fetch active sessions from radacct
    const radacctSessions = await prisma.radacct.findMany({
      where,
      orderBy: { acctstarttime: 'desc' },
    });

    // Process sessions and enrich with user/voucher info
    const sessions = await Promise.all(
      radacctSessions.map(async (session) => {
        const username = session.username;
        
        // Determine session type by checking if user exists in pppoeUser or hotspotVoucher
        const pppoeUser = await prisma.pppoeUser.findUnique({
          where: { username },
          select: { id: true },
        });
        const sessionType = pppoeUser ? 'pppoe' : 'hotspot';
        
        // Apply type filter
        if (type && type !== sessionType) {
          return null;
        }

        // Calculate duration
        const startTime = session.acctstarttime ? new Date(session.acctstarttime) : new Date();
        const durationSeconds = session.acctsessiontime || Math.floor((Date.now() - startTime.getTime()) / 1000);
        
        // Calculate bandwidth
        const uploadBytes = Number(session.acctinputoctets || 0);
        const downloadBytes = Number(session.acctoutputoctets || 0);
        const totalBytes = uploadBytes + downloadBytes;

        // Get router info
        const router = await prisma.router.findFirst({
          where: { nasname: session.nasipaddress },
          select: { id: true, name: true },
        });

        // Get user/voucher info based on type
        let userInfo: any = null;
        if (sessionType === 'pppoe') {
          userInfo = await prisma.pppoeUser.findUnique({
            where: { username },
            select: {
              id: true,
              name: true,
              phone: true,
              profile: {
                select: { name: true },
              },
            },
          });
        } else {
          userInfo = await prisma.hotspotVoucher.findUnique({
            where: { code: username },
            select: {
              id: true,
              status: true,
              profile: {
                select: { name: true },
              },
            },
          });
        }

        return {
          id: session.radacctid.toString(),
          username: session.username,
          sessionId: session.acctsessionid,
          type: sessionType,
          nasIpAddress: session.nasipaddress,
          framedIpAddress: session.framedipaddress,
          macAddress: session.callingstationid,
          startTime: session.acctstarttime,
          duration: durationSeconds,
          durationFormatted: formatDuration(durationSeconds),
          uploadBytes,
          downloadBytes,
          totalBytes,
          uploadFormatted: formatBytes(uploadBytes),
          downloadFormatted: formatBytes(downloadBytes),
          totalFormatted: formatBytes(totalBytes),
          router: router ? {
            id: router.id,
            name: router.name,
          } : null,
          user: sessionType === 'pppoe' && userInfo ? {
            id: userInfo.id,
            name: userInfo.name,
            phone: userInfo.phone,
            profile: userInfo.profile?.name,
          } : null,
          voucher: sessionType === 'hotspot' && userInfo ? {
            id: userInfo.id,
            status: userInfo.status,
            profile: userInfo.profile?.name,
          } : null,
        };
      })
    );

    // Filter out nulls (from type filtering)
    const filteredSessions = sessions.filter(s => s !== null);

    // Calculate active session statistics
    const stats = {
      total: filteredSessions.length,
      pppoe: filteredSessions.filter(s => s?.type === 'pppoe').length,
      hotspot: filteredSessions.filter(s => s?.type === 'hotspot').length,
      totalBandwidth: filteredSessions.reduce((sum, s) => sum + (s?.totalBytes || 0), 0),
    };

    // Calculate ALL TIME statistics (including closed sessions)
    const allTimeStats = await prisma.radacct.aggregate({
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
        acctsessiontime: true,
      },
      _count: {
        radacctid: true,
      },
    });

    const totalAllTimeBytes = 
      (Number(allTimeStats._sum.acctinputoctets) || 0) + 
      (Number(allTimeStats._sum.acctoutputoctets) || 0);

    return NextResponse.json({
      sessions: filteredSessions,
      stats: {
        ...stats,
        totalBandwidthFormatted: formatBytes(stats.totalBandwidth),
      },
      allTimeStats: {
        totalSessions: allTimeStats._count.radacctid || 0,
        totalBandwidth: totalAllTimeBytes,
        totalBandwidthFormatted: formatBytes(totalAllTimeBytes),
        totalDuration: allTimeStats._sum.acctsessiontime || 0,
        totalDurationFormatted: formatDuration(allTimeStats._sum.acctsessiontime || 0),
      },
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
