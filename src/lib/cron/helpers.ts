import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

export async function saveCronHistory(data: {
  jobType: string;
  status: 'running' | 'success' | 'error';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  result?: string;
  error?: string;
}) {
  try {
    await prisma.cronHistory.create({
      data: {
        id: nanoid(),
        ...data,
      },
    });
  } catch (error) {
    console.error('Failed to save cron history:', error);
  }
}

// Cleanup old history (keep last 100 per job type)
export async function cleanupOldHistory() {
  try {
    const jobTypes = ['voucher_sync', 'agent_sales', 'invoice_generate', 'invoice_reminder'];
    
    for (const jobType of jobTypes) {
      const allHistory = await prisma.cronHistory.findMany({
        where: { jobType },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      });

      if (allHistory.length > 100) {
        const idsToDelete = allHistory.slice(100).map((h) => h.id);
        await prisma.cronHistory.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old history:', error);
  }
}
