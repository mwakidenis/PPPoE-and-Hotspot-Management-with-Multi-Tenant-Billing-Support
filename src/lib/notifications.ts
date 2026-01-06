import { prisma } from './prisma';

export const NotificationService = {
  /**
   * Create a notification
   */
  async create(data: {
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    try {
      return await prisma.notification.create({
        data: {
          id: Math.random().toString(36).substring(2, 15),
          ...data,
        },
      });
    } catch (error) {
      console.error('Create notification error:', error);
      return null;
    }
  },

  /**
   * Check and create notifications for overdue invoices
   */
  async checkOverdueInvoices() {
    try {
      const now = new Date();
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            lt: now,
          },
        },
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          customerUsername: true,
          dueDate: true,
        },
      });

      for (const invoice of overdueInvoices) {
        // Check if notification already exists for this invoice
        const existing = await prisma.notification.findFirst({
          where: {
            type: 'invoice_overdue',
            link: `/admin/invoices?id=${invoice.id}`,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        });

        if (!existing) {
          await this.create({
            type: 'invoice_overdue',
            title: 'Invoice Overdue',
            message: `Invoice ${invoice.invoiceNumber} for ${
              invoice.customerName || invoice.customerUsername
            } is overdue`,
            link: `/admin/invoices?id=${invoice.id}`,
          });
        }
      }

      return overdueInvoices.length;
    } catch (error) {
      console.error('Check overdue invoices error:', error);
      return 0;
    }
  },

  /**
   * Check and create notifications for expired users
   */
  async checkExpiredUsers() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const expiredUsers = await prisma.pppoeUser.findMany({
        where: {
          expiredAt: {
            gte: today,
            lt: tomorrow,
          },
          status: 'active',
        },
        select: {
          id: true,
          username: true,
          name: true,
          expiredAt: true,
        },
      });

      for (const user of expiredUsers) {
        // Check if notification already exists
        const existing = await prisma.notification.findFirst({
          where: {
            type: 'user_expired',
            link: `/admin/pppoe/users?id=${user.id}`,
            createdAt: {
              gte: today,
            },
          },
        });

        if (!existing) {
          await this.create({
            type: 'user_expired',
            title: 'User Expiring Today',
            message: `User ${user.username} (${user.name}) is expiring today`,
            link: `/admin/pppoe/users?id=${user.id}`,
          });
        }
      }

      return expiredUsers.length;
    } catch (error) {
      console.error('Check expired users error:', error);
      return 0;
    }
  },

  /**
   * Check and create notifications for pending registrations
   */
  async checkPendingRegistrations() {
    try {
      const pendingRegistrations = await prisma.registrationRequest.findMany({
        where: {
          status: 'PENDING',
        },
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
        },
      });

      let count = 0;
      for (const registration of pendingRegistrations) {
        // Check if notification already exists for this registration
        const existing = await prisma.notification.findFirst({
          where: {
            type: 'new_registration',
            message: {
              contains: registration.phone,
            },
          },
        });

        if (!existing) {
          await this.create({
            type: 'new_registration',
            title: 'New Registration Request',
            message: `${registration.name} (${registration.phone}) requested service registration`,
            link: '/admin/pppoe/registrations',
          });
          count++;
        }
      }

      return count;
    } catch (error) {
      console.error('Check pending registrations error:', error);
      return 0;
    }
  },

  /**
   * Create notification for new registration request
   */
  async notifyNewRegistration(registration: any) {
    return await this.create({
      type: 'new_registration',
      title: 'New Registration Request',
      message: `${registration.name} (${registration.phone}) requested service registration`,
      link: '/admin/pppoe/registrations',
    });
  },

  /**
   * Create notification for payment received
   */
  async notifyPaymentReceived(payment: any) {
    return await this.create({
      type: 'payment_received',
      title: 'Payment Received',
      message: `Payment of Rp ${payment.amount.toLocaleString('id-ID')} received`,
      link: `/admin/invoices?id=${payment.invoiceId}`,
    });
  },

  /**
   * Create system alert notification
   */
  async notifySystemAlert(title: string, message: string, link?: string) {
    return await this.create({
      type: 'system_alert',
      title,
      message,
      link,
    });
  },

  /**
   * Run notification check with DB logging (for cron job)
   */
  async runNotificationCheck() {
    const startedAt = new Date();
    const historyId = Math.random().toString(36).substring(2, 15);

    // Create history record
    const history = await prisma.cronHistory.create({
      data: {
        id: historyId,
        jobType: 'notification_check',
        status: 'running',
        startedAt,
      },
    });

    try {
      const overdue = await this.checkOverdueInvoices();
      const expired = await this.checkExpiredUsers();
      const pending = await this.checkPendingRegistrations();
      const total = overdue + expired + pending;

      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();

      await prisma.cronHistory.update({
        where: { id: historyId },
        data: {
          status: 'success',
          completedAt,
          duration,
          result: JSON.stringify({
            overdueInvoices: overdue,
            expiredUsers: expired,
            pendingRegistrations: pending,
            total,
          }),
        },
      });

      return {
        success: true,
        overdueInvoices: overdue,
        expiredUsers: expired,
        pendingRegistrations: pending,
        total,
      };
    } catch (error: any) {
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();

      await prisma.cronHistory.update({
        where: { id: historyId },
        data: {
          status: 'error',
          completedAt,
          duration,
          error: error.message,
        },
      });

      console.error('Notification check error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};
