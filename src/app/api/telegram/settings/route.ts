import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { testTelegramConnection } from '@/lib/telegram';

// GET - Get current Telegram settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is SUPER_ADMIN
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await prisma.telegramBackupSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      return NextResponse.json({
        enabled: false,
        botToken: '',
        chatId: '',
        backupTopicId: '',
        healthTopicId: '',
        schedule: 'daily',
        scheduleTime: '00:00',
        keepLastN: 7,
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('[Telegram Settings] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

// POST - Update Telegram settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is SUPER_ADMIN
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      enabled,
      botToken,
      chatId,
      backupTopicId,
      healthTopicId,
      schedule,
      scheduleTime,
      keepLastN,
    } = body;

    // Validate required fields if enabled
    if (enabled) {
      if (!botToken || !chatId) {
        return NextResponse.json(
          { error: 'Bot token and chat ID are required when enabled' },
          { status: 400 }
        );
      }
    }

    // Delete old settings and create new one
    await prisma.telegramBackupSettings.deleteMany({});
    
    const settings = await prisma.telegramBackupSettings.create({
      data: {
        enabled: enabled || false,
        botToken: botToken || '',
        chatId: chatId || '',
        backupTopicId: backupTopicId || null,
        healthTopicId: healthTopicId || null,
        schedule: schedule || 'daily',
        scheduleTime: scheduleTime || '00:00',
        keepLastN: keepLastN || 7,
      },
    });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('[Telegram Settings] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
