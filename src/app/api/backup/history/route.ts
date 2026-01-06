import { NextRequest, NextResponse } from 'next/server';
import { getBackupHistory } from '@/lib/backup';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is SUPER_ADMIN
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const history = await getBackupHistory(50);

    // Convert BigInt to Number for JSON serialization
    const serializedHistory = history.map((item) => ({
      ...item,
      filesize: Number(item.filesize),
    }));

    return NextResponse.json({
      success: true,
      history: serializedHistory,
    });
  } catch (error: any) {
    console.error('[Backup History API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
