import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { CRON_JOBS, getNextRunTime } from '@/lib/cron/config';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get latest run for each job type
    const jobsStatus = await Promise.all(
      CRON_JOBS.map(async (job) => {
        // Get last 5 runs
        const history = await prisma.cronHistory.findMany({
          where: { jobType: job.type },
          orderBy: { startedAt: 'desc' },
          take: 5,
        });

        const lastRun = history[0];
        const lastSuccess = history.find((h) => h.status === 'success');
        
        // Calculate health status
        const recentRuns = history.slice(0, 3);
        const failureCount = recentRuns.filter((h) => h.status === 'error').length;
        const health = failureCount >= 2 ? 'unhealthy' : failureCount === 1 ? 'degraded' : 'healthy';

        // Calculate next run
        const nextRun = lastRun?.startedAt 
          ? getNextRunTime(job.schedule, new Date(lastRun.startedAt))
          : getNextRunTime(job.schedule);

        return {
          ...job,
          lastRun: lastRun ? {
            startedAt: lastRun.startedAt,
            completedAt: lastRun.completedAt,
            status: lastRun.status,
            duration: lastRun.duration,
            result: lastRun.result,
            error: lastRun.error,
          } : null,
          lastSuccessAt: lastSuccess?.startedAt,
          nextRun,
          health,
          recentHistory: history.slice(0, 10),
        };
      })
    );

    return NextResponse.json({
      success: true,
      jobs: jobsStatus,
    });
  } catch (error) {
    console.error('Get cron status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get cron status' },
      { status: 500 }
    );
  }
}
