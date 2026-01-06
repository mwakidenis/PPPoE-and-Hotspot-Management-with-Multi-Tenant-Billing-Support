import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCoADisconnect } from '@/lib/services/coaService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionIds, usernames } = body; // Support both session IDs or usernames

    if (!sessionIds && !usernames) {
      return NextResponse.json(
        { error: 'sessionIds or usernames required' },
        { status: 400 }
      );
    }

    let results: any[] = [];

    // If sessionIds provided, disconnect by session IDs
    if (sessionIds && Array.isArray(sessionIds)) {
      for (const sessionId of sessionIds) {
        try {
          // Find session in radacct
          const session = await prisma.radacct.findFirst({
            where: {
              acctsessionid: sessionId,
              acctstoptime: null, // Only active sessions
            },
          });

          if (!session) {
            results.push({
              sessionId,
              success: false,
              error: 'Session not found or already stopped',
            });
            continue;
          }

          // Get NAS configuration
          const router = await prisma.router.findFirst({
            where: { nasname: session.nasipaddress },
          });

          if (!router) {
            results.push({
              sessionId,
              success: false,
              error: 'Router not configured',
            });
            continue;
          }

          // Send COA disconnect
          const result = await sendCoADisconnect(
            session.username,
            session.nasipaddress,
            router.secret,
            session.acctsessionid,
            session.framedipaddress
          );

          results.push({
            sessionId,
            username: session.username,
            ...result,
          });
        } catch (error: any) {
          results.push({
            sessionId,
            success: false,
            error: error.message,
          });
        }
      }
    }

    // If usernames provided, disconnect by username
    if (usernames && Array.isArray(usernames)) {
      for (const username of usernames) {
        try {
          // Find active session for username
          const session = await prisma.radacct.findFirst({
            where: {
              username,
              acctstoptime: null,
            },
            orderBy: {
              acctstarttime: 'desc',
            },
          });

          if (!session) {
            results.push({
              username,
              success: false,
              error: 'No active session found',
            });
            continue;
          }

          // Get NAS configuration
          const router = await prisma.router.findFirst({
            where: { nasname: session.nasipaddress },
          });

          if (!router) {
            results.push({
              username,
              success: false,
              error: 'Router not configured',
            });
            continue;
          }

          // Send COA disconnect
          const result = await sendCoADisconnect(
            session.username,
            session.nasipaddress,
            router.secret,
            session.acctsessionid,
            session.framedipaddress
          );

          results.push({
            username,
            sessionId: session.acctsessionid,
            ...result,
          });
        } catch (error: any) {
          results.push({
            username,
            success: false,
            error: error.message,
          });
        }
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error('Disconnect sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
