import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';

// POST - Test Telegram connection
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
    const { botToken, chatId, backupTopicId, healthTopicId } = body;

    if (!botToken || !chatId) {
      return NextResponse.json(
        { error: 'Bot token and chat ID are required' },
        { status: 400 }
      );
    }

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const results = [];

    // 1. Send to General Chat (no topic)
    const generalResult = await sendTelegramMessage(
      { botToken, chatId },
      `🤖 <b>AIBILL RADIUS - Test Connection</b>\n\n✅ General chat connection successful!\n\n📅 ${now} WIB`
    );
    results.push({ location: 'General Chat', success: generalResult.success, error: generalResult.error });

    // 2. Send to Backup Topic (if provided)
    if (backupTopicId) {
      const backupResult = await sendTelegramMessage(
        { botToken, chatId, topicId: backupTopicId },
        `💾 <b>AIBILL RADIUS - Database Backup Topic Test</b>\n\n✅ Backup topic connection successful!\nThis topic will receive database backup files.\n\n📅 ${now} WIB`
      );
      results.push({ location: 'Backup Topic', success: backupResult.success, error: backupResult.error });
    }

    // 3. Send to Health Topic (if provided)
    if (healthTopicId) {
      const healthResult = await sendTelegramMessage(
        { botToken, chatId, topicId: healthTopicId },
        `🏥 <b>AIBILL RADIUS - Health Check Topic Test</b>\n\n✅ Health topic connection successful!\nThis topic will receive database health reports.\n\n📅 ${now} WIB`
      );
      results.push({ location: 'Health Topic', success: healthResult.success, error: healthResult.error });
    }

    // Check if all tests passed
    const allSuccess = results.every(r => r.success);
    const failedTests = results.filter(r => !r.success);

    if (!allSuccess) {
      return NextResponse.json(
        { 
          success: false,
          error: `Some tests failed: ${failedTests.map(f => `${f.location} (${f.error})`).join(', ')}`,
          results 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test messages sent to ${results.length} location(s)!`,
      results,
    });
  } catch (error: any) {
    console.error('[Telegram Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to test connection' },
      { status: 500 }
    );
  }
}
