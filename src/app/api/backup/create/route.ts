import { NextRequest, NextResponse } from 'next/server';
import { createBackup } from '@/lib/backup';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is SUPER_ADMIN
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only SUPER_ADMIN can create backups' }, { status: 403 });
    }

    console.log(`[Backup API] User ${session.user.username} initiated manual backup`);

    const result = await createBackup('manual');

    return NextResponse.json({
      success: true,
      filename: result.backup.filename,
      downloadUrl: `/api/backup/download/${result.backup.id}`,
      backup: {
        id: result.backup.id,
        filename: result.backup.filename,
        filesize: Number(result.backup.filesize),
        createdAt: result.backup.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[Backup API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
