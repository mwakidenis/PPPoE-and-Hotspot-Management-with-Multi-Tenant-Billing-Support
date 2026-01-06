import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppService } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';

interface BroadcastRequest {
  userIds: string[];
  message: string;
  delay?: number; // Delay in ms between each message (default 2000ms)
}

export async function POST(request: NextRequest) {
  try {
    const body: BroadcastRequest = await request.json();
    const { userIds, message, delay = 2000 } = body;

    if (!userIds || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No users selected' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Fetch users
    const users = await prisma.pppoeUser.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        profile: {
          select: {
            name: true,
          },
        },
      },
    });

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid users found' },
        { status: 400 }
      );
    }

    // Get company info for variables
    const company = await prisma.company.findFirst();

    // Prepare messages for batch sending with rate limiting
    const messagesToSend = users
      .filter(user => user.phone) // Only users with phone numbers
      .map(user => ({
        phone: user.phone!,
        message: message
          .replace(/\{\{customerName\}\}/g, user.name)
          .replace(/\{\{username\}\}/g, user.username)
          .replace(/\{\{profileName\}\}/g, user.profile?.name || '-')
          .replace(/\{\{companyName\}\}/g, company?.name || '')
          .replace(/\{\{companyPhone\}\}/g, company?.phone || ''),
        data: {
          userId: user.id,
          name: user.name,
          username: user.username,
        }
      }));

    // Track users without phone numbers
    const usersWithoutPhone = users.filter(user => !user.phone);
    
    console.log(`[Broadcast] Sending to ${messagesToSend.length} users (${usersWithoutPhone.length} skipped - no phone)`);

    // Send messages with rate limiting (5 msg per 10 seconds)
    const { sendWithRateLimit, estimateSendTime, formatEstimatedTime } = await import('@/lib/utils/rateLimiter');
    
    const estimatedTime = estimateSendTime(messagesToSend.length);
    console.log(`[Broadcast] Estimated time: ${formatEstimatedTime(estimatedTime)}`);

    const result = await sendWithRateLimit(
      messagesToSend,
      async (msg) => {
        // Send message using WhatsApp failover service
        const sendResult = await WhatsAppService.sendMessage({
          phone: msg.phone,
          message: msg.message,
        });
        return sendResult;
      },
      {}, // Use default config: 5 msg/10sec
      (progress) => {
        console.log(`[Broadcast] Progress: ${progress.current}/${progress.total} (Batch ${progress.batch}/${progress.totalBatches})`)
      }
    );

    // Build detailed results
    const detailedResults = [
      // Successful sends
      ...result.results
        .filter(r => r.success)
        .map(r => {
          const userData = messagesToSend.find(m => m.phone === r.phone)?.data;
          return {
            userId: userData?.userId,
            name: userData?.name,
            username: userData?.username,
            phone: r.phone,
            success: true,
          };
        }),
      // Failed sends
      ...result.results
        .filter(r => !r.success)
        .map(r => {
          const userData = messagesToSend.find(m => m.phone === r.phone)?.data;
          return {
            userId: userData?.userId,
            name: userData?.name,
            username: userData?.username,
            phone: r.phone,
            success: false,
            error: r.error,
          };
        }),
      // Users without phone
      ...usersWithoutPhone.map(user => ({
        userId: user.id,
        name: user.name,
        username: user.username,
        phone: null,
        success: false,
        error: 'No phone number',
      })),
    ];

    return NextResponse.json({
      success: true,
      total: users.length,
      successCount: result.sent,
      failCount: result.failed + usersWithoutPhone.length,
      results: detailedResults,
      estimatedTime: formatEstimatedTime(estimatedTime),
    });
  } catch (error: any) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
