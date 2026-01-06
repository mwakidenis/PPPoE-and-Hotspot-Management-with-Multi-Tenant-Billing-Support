import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from './prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Parse DATABASE_URL to get credentials
function parseDbUrl(url: string) {
  // Format: mysql://user:pass@host:port/dbname
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

// Create backups directory if not exists
async function ensureBackupDir() {
  const backupDir = path.join(process.cwd(), 'backups');
  try {
    await fs.access(backupDir);
  } catch {
    await fs.mkdir(backupDir, { recursive: true });
  }
  return backupDir;
}

/**
 * Create database backup using mysqldump
 */
export async function createBackup(type: 'auto' | 'manual' = 'manual') {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not configured');
  }

  const { user, password, host, database } = parseDbUrl(dbUrl);
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
  const filename = `aibill_backup_${timestamp}.sql`;
  
  const backupDir = await ensureBackupDir();
  const filepath = path.join(backupDir, filename);

  try {
    // Run mysqldump command
    // Note: Using MYSQL_PWD env var to avoid password in command line
    const command = `MYSQL_PWD="${password}" mysqldump -u ${user} -h ${host} --single-transaction --routines --triggers ${database} > "${filepath}"`;
    
    console.log('[Backup] Creating backup:', filename);
    await execAsync(command);
    
    // Get file size
    const stats = await fs.stat(filepath);
    const filesize = stats.size;
    
    console.log('[Backup] Backup created successfully:', filename, `(${filesize} bytes)`);
    
    // Save to database
    const history = await prisma.backupHistory.create({
      data: {
        id: crypto.randomUUID(),
        filename,
        filepath,
        filesize,
        type,
        status: 'success',
        method: 'local',
      },
    });
    
    return {
      success: true,
      backup: history,
      filepath,
    };
  } catch (error: any) {
    console.error('[Backup] Error:', error);
    
    // Try to save error to database
    try {
      await prisma.backupHistory.create({
        data: {
          id: crypto.randomUUID(),
          filename,
          filepath: null,
          filesize: 0,
          type,
          status: 'failed',
          method: 'local',
          error: error.message,
        },
      });
    } catch (dbError) {
      console.error('[Backup] Failed to log error to database:', dbError);
    }
    
    throw new Error('Backup failed: ' + error.message);
  }
}

/**
 * Restore database from SQL file
 */
export async function restoreBackup(filepath: string) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not configured');
  }

  const { user, password, host, database } = parseDbUrl(dbUrl);

  try {
    // Verify file exists
    await fs.access(filepath);
    
    console.log('[Restore] Restoring from:', filepath);
    
    // Run mysql import command
    const command = `MYSQL_PWD="${password}" mysql -u ${user} -h ${host} ${database} < "${filepath}"`;
    
    await execAsync(command);
    
    console.log('[Restore] Database restored successfully');
    
    return {
      success: true,
      message: 'Database restored successfully',
    };
  } catch (error: any) {
    console.error('[Restore] Error:', error);
    throw new Error('Restore failed: ' + error.message);
  }
}

/**
 * Delete backup file and database record
 */
export async function deleteBackup(id: string) {
  try {
    const backup = await prisma.backupHistory.findUnique({
      where: { id },
    });
    
    if (!backup) {
      throw new Error('Backup not found');
    }
    
    // Delete file if exists
    if (backup.filepath) {
      try {
        await fs.unlink(backup.filepath);
        console.log('[Delete] File deleted:', backup.filepath);
      } catch (err) {
        console.error('[Delete] File not found or already deleted:', backup.filepath);
      }
    }
    
    // Delete from database
    await prisma.backupHistory.delete({
      where: { id },
    });
    
    console.log('[Delete] Backup record deleted:', id);
    
    return {
      success: true,
      message: 'Backup deleted successfully',
    };
  } catch (error: any) {
    console.error('[Delete] Error:', error);
    throw new Error('Delete failed: ' + error.message);
  }
}

/**
 * Get backup history from database
 */
export async function getBackupHistory(limit: number = 50) {
  return await prisma.backupHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get database health information
 */
export async function getDatabaseHealth() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not configured');
  }

  const { user, password, host, database } = parseDbUrl(dbUrl);

  try {
    // Get database size
    const sizeResult = await prisma.$queryRaw<any[]>`
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
      FROM information_schema.tables 
      WHERE table_schema = ${database}
    `;
    const sizeMB = sizeResult[0]?.size_mb || 0;
    
    // Get table count
    const tableResult = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = ${database}
    `;
    const tableCount = Number(tableResult[0]?.count || 0);
    
    // Get connection count
    const connResult = await prisma.$queryRaw<any[]>`
      SHOW STATUS LIKE 'Threads_connected'
    `;
    const connections = connResult[0]?.Value || '0';
    
    // Get max connections
    const maxConnResult = await prisma.$queryRaw<any[]>`
      SHOW VARIABLES LIKE 'max_connections'
    `;
    const maxConnections = maxConnResult[0]?.Value || '100';
    
    // Get uptime
    const uptimeResult = await prisma.$queryRaw<any[]>`
      SHOW STATUS LIKE 'Uptime'
    `;
    const uptimeSeconds = parseInt(uptimeResult[0]?.Value || '0');
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptime = `${uptimeDays}d ${uptimeHours}h`;
    
    // Get last backup
    const lastBackup = await prisma.backupHistory.findFirst({
      where: { status: 'success' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    
    // Determine health status
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    const connPercent = (parseInt(connections) / parseInt(maxConnections)) * 100;
    
    if (connPercent > 80) {
      status = 'warning';
    }
    if (connPercent > 95) {
      status = 'error';
    }
    
    return {
      success: true,
      health: {
        status,
        size: `${sizeMB} MB`,
        tables: tableCount,
        connections: `${connections}/${maxConnections}`,
        lastBackup: lastBackup?.createdAt.toISOString() || null,
        uptime,
      },
    };
  } catch (error: any) {
    console.error('[Health] Error:', error);
    return {
      success: false,
      health: {
        status: 'error' as const,
        size: 'N/A',
        tables: 0,
        connections: 'N/A',
        lastBackup: null,
        uptime: 'N/A',
      },
      error: error.message,
    };
  }
}

/**
 * Cleanup old backups (keep last N)
 */
export async function cleanupOldBackups(keepLast: number = 7) {
  try {
    // Get all backups ordered by date
    const allBackups = await prisma.backupHistory.findMany({
      where: { status: 'success' },
      orderBy: { createdAt: 'desc' },
    });
    
    // Skip first N (keep these)
    const toDelete = allBackups.slice(keepLast);
    
    console.log(`[Cleanup] Found ${allBackups.length} backups, will delete ${toDelete.length} old backups`);
    
    let deleted = 0;
    for (const backup of toDelete) {
      try {
        await deleteBackup(backup.id);
        deleted++;
      } catch (err) {
        console.error(`[Cleanup] Failed to delete ${backup.id}:`, err);
      }
    }
    
    console.log(`[Cleanup] Deleted ${deleted}/${toDelete.length} old backups`);
    
    return {
      success: true,
      deleted,
      total: toDelete.length,
    };
  } catch (error: any) {
    console.error('[Cleanup] Error:', error);
    throw new Error('Cleanup failed: ' + error.message);
  }
}
