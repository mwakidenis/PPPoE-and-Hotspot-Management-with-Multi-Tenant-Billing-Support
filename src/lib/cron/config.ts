export interface CronJobConfig {
  type: string;
  name: string;
  description: string;
  schedule: string; // cron pattern
  scheduleLabel: string; // human readable
  handler: () => Promise<any>;
  enabled: boolean;
}

// Centralized cron configuration
export const CRON_JOBS: CronJobConfig[] = [
  {
    type: 'voucher_sync',
    name: 'Voucher Sync',
    description: 'Sync voucher status from RADIUS logs and disconnect expired sessions',
    schedule: '* * * * *',
    scheduleLabel: 'Every minute',
    handler: async () => {
      const { syncVoucherFromRadius } = await import('./voucher-sync');
      return syncVoucherFromRadius();
    },
    enabled: true,
  },
  {
    type: 'agent_sales',
    name: 'Agent Sales Recording',
    description: 'Record agent sales for active vouchers and calculate commissions',
    schedule: '*/5 * * * *',
    scheduleLabel: 'Every 5 minutes',
    handler: async () => {
      const { recordAgentSales } = await import('./voucher-sync');
      return recordAgentSales();
    },
    enabled: true,
  },
  {
    type: 'invoice_generate',
    name: 'Invoice Generation',
    description: 'Generate monthly invoices for active PPPoE users',
    schedule: '0 7 * * *',
    scheduleLabel: 'Daily at 7 AM',
    handler: async () => {
      const { generateInvoices } = await import('./voucher-sync');
      return generateInvoices();
    },
    enabled: true,
  },
  {
    type: 'invoice_reminder',
    name: 'Invoice Reminder',
    description: 'Send WhatsApp reminders for unpaid invoices based on schedule',
    schedule: '0 * * * *',
    scheduleLabel: 'Every hour',
    handler: async () => {
      const { sendInvoiceReminders } = await import('./voucher-sync');
      return sendInvoiceReminders();
    },
    enabled: true,
  },
  {
    type: 'notification_check',
    name: 'Notification Check',
    description: 'Check for overdue invoices, expired users, and pending registrations',
    schedule: '0 */6 * * *',
    scheduleLabel: 'Every 6 hours',
    handler: async () => {
      const { NotificationService } = await import('../notifications');
      return await NotificationService.runNotificationCheck();
    },
    enabled: true,
  },
  {
    type: 'auto_isolir',
    name: 'Auto Isolir Expired Users',
    description: 'Automatically isolate PPPoE users with expired date past today',
    schedule: '0 * * * *',
    scheduleLabel: 'Every hour',
    handler: async () => {
      const { autoIsolateExpiredUsers } = await import('./voucher-sync');
      return autoIsolateExpiredUsers();
    },
    enabled: true,
  },
  {
    type: 'telegram_backup',
    name: 'Telegram Auto Backup',
    description: 'Automatic database backup to Telegram based on schedule (daily/12h/6h/weekly)',
    schedule: 'dynamic', // Schedule is set by settings
    scheduleLabel: 'Based on settings',
    handler: async () => {
      const { autoBackupToTelegram } = await import('./telegram-cron');
      return autoBackupToTelegram();
    },
    enabled: true,
  },
  {
    type: 'telegram_health',
    name: 'Telegram Health Check',
    description: 'Send comprehensive system health report to Telegram (DB, RADIUS, billing status)',
    schedule: '0 * * * *',
    scheduleLabel: 'Every hour',
    handler: async () => {
      const { sendHealthCheckToTelegram } = await import('./telegram-cron');
      return sendHealthCheckToTelegram();
    },
    enabled: true,
  },
];

// Helper to get next run time from cron pattern
export function getNextRunTime(cronPattern: string, from: Date = new Date()): Date {
  // Simple implementation for common patterns
  // For production, use 'cron-parser' library
  const now = new Date(from);
  
  if (cronPattern === '* * * * *') {
    // Every minute
    return new Date(now.getTime() + 60000);
  } else if (cronPattern === '*/5 * * * *') {
    // Every 5 minutes
    const nextMinute = Math.ceil(now.getMinutes() / 5) * 5;
    const next = new Date(now);
    next.setMinutes(nextMinute, 0, 0);
    if (next <= now) next.setMinutes(nextMinute + 5);
    return next;
  } else if (cronPattern === '0 * * * *') {
    // Every hour
    const next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    return next;
  } else if (cronPattern === '0 7 * * *') {
    // Daily at 7 AM
    const next = new Date(now);
    next.setHours(7, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  } else if (cronPattern === '0 */6 * * *') {
    // Every 6 hours (at 0, 6, 12, 18)
    const next = new Date(now);
    const currentHour = now.getHours();
    const nextHour = Math.ceil((currentHour + 1) / 6) * 6;
    next.setHours(nextHour, 0, 0, 0);
    if (next <= now) next.setHours(nextHour + 6, 0, 0, 0);
    return next;
  }
  
  return new Date(now.getTime() + 60000); // Default: 1 minute
}
