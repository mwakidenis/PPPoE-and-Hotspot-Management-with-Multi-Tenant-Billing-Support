/**
 * Next.js Instrumentation
 * Called once when the server starts
 */
export async function register() {
  console.log('[INSTRUMENTATION] Register called, runtime:', process.env.NEXT_RUNTIME)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[INSTRUMENTATION] Initializing cron jobs...')
    const { initCronJobs } = await import('./lib/cron/voucher-sync')
    initCronJobs()
  }
}
