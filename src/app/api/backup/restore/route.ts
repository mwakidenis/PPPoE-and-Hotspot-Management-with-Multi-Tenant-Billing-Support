import { NextRequest, NextResponse } from 'next/server';
import { restoreBackup } from '@/lib/backup';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is SUPER_ADMIN
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only SUPER_ADMIN can restore database' }, { status: 403 });
    }

    console.log(`[Restore API] User ${session.user.username} initiated database restore`);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.sql')) {
      return NextResponse.json({ error: 'File must be .sql format' }, { status: 400 });
    }

    // Save uploaded file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const tempFilepath = path.join(process.cwd(), 'backups', `restore_temp_${Date.now()}.sql`);
    await writeFile(tempFilepath, buffer);

    console.log('[Restore API] File uploaded, starting restore...');

    // Restore database
    await restoreBackup(tempFilepath);

    // Clean up temp file
    const fs = require('fs/promises');
    try {
      await fs.unlink(tempFilepath);
    } catch (err) {
      console.error('[Restore API] Failed to delete temp file:', err);
    }

    console.log('[Restore API] Database restored successfully');

    return NextResponse.json({
      success: true,
      message: 'Database restored successfully',
    });
  } catch (error: any) {
    console.error('[Restore API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
