import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendBackupToTelegram } from '@/lib/telegram';
import * as fs from 'fs/promises';

// POST - Send backup to Telegram manually
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

    const { backupId } = await request.json();

    if (!backupId) {
      return NextResponse.json(
        { error: 'Backup ID is required' },
        { status: 400 }
      );
    }

    // Get Telegram settings
    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      return NextResponse.json(
        { error: 'Telegram backup is not enabled or configured' },
        { status: 400 }
      );
    }

    // Get backup info
    const backup = await prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      return NextResponse.json(
        { error: 'Backup not found' },
        { status: 404 }
      );
    }

    // Check if file exists
    try {
      await fs.access(backup.filePath);
    } catch {
      return NextResponse.json(
        { error: 'Backup file not found on disk' },
        { status: 404 }
      );
    }

    // Send to Telegram
    const result = await sendBackupToTelegram(
      {
        botToken: settings.botToken,
        chatId: settings.chatId,
        topicId: settings.backupTopicId || undefined,
      },
      backup.filePath,
      backup.fileSize
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send backup to Telegram' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Backup sent to Telegram successfully!',
    });
  } catch (error: any) {
    console.error('[Telegram Send Backup] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send backup' },
      { status: 500 }
    );
  }
}
