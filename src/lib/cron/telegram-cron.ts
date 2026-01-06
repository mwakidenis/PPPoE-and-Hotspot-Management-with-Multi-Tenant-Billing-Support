import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { sendBackupToTelegram, sendHealthReport } from '@/lib/telegram';
import { createBackup } from '@/lib/backup';
import * as fs from 'fs/promises';

let backupCronJob: cron.ScheduledTask | null = null;
let healthCronJob: cron.ScheduledTask | null = null;

/**
 * Create and send database backup to Telegram
 */
export async function autoBackupToTelegram(): Promise<{ success: boolean; error?: string }> {
  const startedAt = new Date();
  
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'telegram_backup',
      status: 'running',
      startedAt,
    },
  });

  try {
    // Get Telegram settings
    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      const completedAt = new Date();
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: 'Telegram backup disabled, skipped',
        },
      });
      return { success: true };
    }

    // Create backup
    console.log('[Telegram Backup] Creating database backup...');
    const backupResult = await createBackup('auto');
    
    if (!backupResult.success) {
      throw new Error('Backup creation failed');
    }

    const backup = backupResult.backup;

    // Check if file exists
    try {
      await fs.access(backupResult.filepath);
    } catch {
      throw new Error('Backup file not found on disk');
    }

    // Send to Telegram
    console.log('[Telegram Backup] Sending backup to Telegram...');
    const sendResult = await sendBackupToTelegram(
      {
        botToken: settings.botToken,
        chatId: settings.chatId,
        topicId: settings.backupTopicId || undefined,
      },
      backupResult.filepath,
      backup.filesize
    );

    if (!sendResult.success) {
      throw new Error(sendResult.error || 'Failed to send to Telegram');
    }

    // Clean up old backups if needed
    if (settings.keepLastN > 0) {
      const allBackups = await prisma.backupHistory.findMany({
        where: { type: 'auto' },
        orderBy: { createdAt: 'desc' },
      });

      const backupsToDelete = allBackups.slice(settings.keepLastN);
      
      for (const oldBackup of backupsToDelete) {
        try {
          if (oldBackup.filepath) {
            await fs.unlink(oldBackup.filepath);
          }
          await prisma.backupHistory.delete({ where: { id: oldBackup.id } });
          console.log(`[Telegram Backup] Deleted old backup: ${oldBackup.filename}`);
        } catch (error) {
          console.error(`[Telegram Backup] Failed to delete ${oldBackup.filename}:`, error);
        }
      }
    }

    const completedAt = new Date();
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Backup sent to Telegram: ${backup.filename}`,
      },
    });

    console.log('[Telegram Backup] Completed successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[Telegram Backup] Error:', error);
    
    const completedAt = new Date();
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send comprehensive health check to Telegram
 */
export async function sendHealthCheckToTelegram(): Promise<{ success: boolean; error?: string }> {
  const startedAt = new Date();
  
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'telegram_health',
      status: 'running',
      startedAt,
    },
  });

  try {
    // Get Telegram settings
    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      const completedAt = new Date();
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: 'Telegram health check disabled, skipped',
        },
      });
      return { success: true };
    }

    // Get comprehensive health data
    const health = await getComprehensiveHealth();

    // Send to Telegram
    console.log('[Telegram Health] Sending health report...');
    const sendResult = await sendHealthReport(
      {
        botToken: settings.botToken,
        chatId: settings.chatId,
        topicId: settings.healthTopicId || undefined,
      },
      health
    );

    if (!sendResult.success) {
      throw new Error(sendResult.error || 'Failed to send to Telegram');
    }

    const completedAt = new Date();
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Health report sent (status: ${health.status})`,
      },
    });

    console.log('[Telegram Health] Completed successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[Telegram Health] Error:', error);
    
    const completedAt = new Date();
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Get comprehensive system health including DB, billing, and RADIUS
 */
async function getComprehensiveHealth() {
  try {
    // Database health
    const sizeResult: any = await prisma.$queryRawUnsafe(`
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
      FROM information_schema.TABLES 
      WHERE table_schema = DATABASE()
    `);

    const tableResult: any = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count 
      FROM information_schema.TABLES 
      WHERE table_schema = DATABASE()
    `);

    const connectionResult: any = await prisma.$queryRawUnsafe(`
      SHOW STATUS LIKE 'Threads_connected'
    `);

    const uptimeResult: any = await prisma.$queryRawUnsafe(`
      SHOW STATUS LIKE 'Uptime'
    `);

    // RADIUS health - check active sessions
    const activeSessions = await prisma.radacct.count({
      where: {
        acctstoptime: null,
      },
    });

    // Billing health - check pending invoices
    const pendingInvoices = await prisma.invoice.count({
      where: {
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
    });

    // PPPoE users count
    const totalUsers = await prisma.pppoeUser.count();
    const activeUsers = await prisma.pppoeUser.count({
      where: { status: 'ACTIVE' },
    });

    const sizeMB = sizeResult[0]?.size_mb || 0;
    const tableCount = Number(tableResult[0]?.count) || 0;
    const connections = connectionResult[0]?.Value || '0';
    const uptimeSeconds = Number(uptimeResult[0]?.Value) || 0;
    
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptime = `${days}d ${hours}h`;

    // Determine overall status
    let status = 'healthy';
    const issues = [];

    if (sizeMB > 5000) {
      status = 'critical';
      issues.push('Database size > 5GB');
    } else if (sizeMB > 1000) {
      status = 'warning';
      issues.push('Database size > 1GB');
    }

    if (Number(connections) > 100) {
      status = 'critical';
      issues.push('Too many DB connections');
    } else if (Number(connections) > 50) {
      if (status === 'healthy') status = 'warning';
      issues.push('High DB connections');
    }

    if (pendingInvoices > 50) {
      if (status === 'healthy') status = 'warning';
      issues.push(`${pendingInvoices} overdue invoices`);
    }

    return {
      status,
      size: `${sizeMB} MB`,
      tables: tableCount,
      connections: connections,
      uptime,
      activeSessions,
      totalUsers,
      activeUsers,
      pendingInvoices,
      issues: issues.length > 0 ? issues.join(', ') : undefined,
    };
  } catch (error) {
    console.error('[Health Check] Error:', error);
    return {
      status: 'unknown',
      size: 'N/A',
      tables: 0,
      connections: 'N/A',
      uptime: 'N/A',
      activeSessions: 0,
      totalUsers: 0,
      activeUsers: 0,
      pendingInvoices: 0,
    };
  }
}

/**
 * Start or restart backup cron job based on settings
 */
export async function startBackupCron() {
  try {
    // Stop existing job if running
    if (backupCronJob) {
      backupCronJob.stop();
      backupCronJob = null;
    }

    // Get settings
    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      console.log('[Telegram Backup Cron] Disabled or not configured, skipping');
      return;
    }

    console.log('[Telegram Backup Cron] Settings found:', {
      enabled: settings.enabled,
      schedule: settings.schedule,
      scheduleTime: settings.scheduleTime,
    });

    // Parse schedule time (HH:mm format)
    const [hour, minute] = settings.scheduleTime.split(':').map(Number);

  // Build cron expression based on schedule
  let cronExpression = '';
  
  switch (settings.schedule) {
    case 'daily':
      cronExpression = `${minute} ${hour} * * *`; // Daily at specified time
      break;
    case '12h':
      cronExpression = `${minute} ${hour},${(hour + 12) % 24} * * *`; // Every 12 hours
      break;
    case '6h':
      cronExpression = `${minute} ${hour},${(hour + 6) % 24},${(hour + 12) % 24},${(hour + 18) % 24} * * *`; // Every 6 hours
      break;
    case 'weekly':
      cronExpression = `${minute} ${hour} * * 0`; // Weekly on Sunday
      break;
    default:
      cronExpression = `${minute} ${hour} * * *`; // Default: daily
  }

  console.log(`[Telegram Backup Cron] Starting with schedule: ${settings.schedule} at ${settings.scheduleTime} WIB (cron: ${cronExpression})`);

  backupCronJob = cron.schedule(cronExpression, async () => {
    console.log('[Telegram Backup Cron] Running...');
    const result = await autoBackupToTelegram();
    console.log('[Telegram Backup Cron] Result:', result);
  }, {
    timezone: 'Asia/Jakarta' // WIB timezone
  });

  backupCronJob.start();
  console.log('[Telegram Backup Cron] Successfully started');
  } catch (error) {
    console.error('[Telegram Backup Cron] Failed to start:', error);
  }
}

/**
 * Start health check cron (runs every hour)
 */
export async function startHealthCron() {
  try {
    // Stop existing job if running
    if (healthCronJob) {
      healthCronJob.stop();
      healthCronJob = null;
    }

    // Check if enabled
    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      console.log('[Telegram Health Cron] Disabled or not configured, skipping');
      return;
    }

    console.log('[Telegram Health Cron] Starting (every hour at :00)');

    healthCronJob = cron.schedule('0 * * * *', async () => {
      console.log('[Telegram Health Cron] Running...');
      const result = await sendHealthCheckToTelegram();
      console.log('[Telegram Health Cron] Result:', result);
    }, {
      timezone: 'Asia/Jakarta' // WIB timezone
    });

    healthCronJob.start();
    console.log('[Telegram Health Cron] Successfully started');
  } catch (error) {
    console.error('[Telegram Health Cron] Failed to start:', error);
  }
}

/**
 * Stop backup cron
 */
export function stopBackupCron() {
  if (backupCronJob) {
    backupCronJob.stop();
    backupCronJob = null;
    console.log('[Telegram Backup Cron] Stopped');
  }
}

/**
 * Stop health cron
 */
export function stopHealthCron() {
  if (healthCronJob) {
    healthCronJob.stop();
    healthCronJob = null;
    console.log('[Telegram Health Cron] Stopped');
  }
}

/**
 * Get cron status
 */
export function getTelegramCronStatus() {
  return {
    backup: {
      running: backupCronJob !== null,
    },
    health: {
      running: healthCronJob !== null,
    },
  };
}
