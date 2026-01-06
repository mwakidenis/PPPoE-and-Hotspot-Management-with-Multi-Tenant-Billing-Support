import { NextRequest, NextResponse } from 'next/server'
import { getCronHistory, syncVoucherFromRadius, recordAgentSales, generateInvoices, sendInvoiceReminders, autoIsolateExpiredUsers } from '@/lib/cron/voucher-sync'

/**
 * GET /api/cron - Get cron history
 */
export async function GET(request: NextRequest) {
  try {
    const history = await getCronHistory()
    
    return NextResponse.json({
      success: true,
      history
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * POST /api/cron - Manual trigger cron job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const jobType = body.type || 'voucher_sync'
    
    let result: any
    
    switch (jobType) {
      case 'voucher_sync':
        result = await syncVoucherFromRadius()
        return NextResponse.json({
          success: result.success,
          synced: result.synced,
          error: result.error
        })
        
      case 'agent_sales':
        result = await recordAgentSales()
        return NextResponse.json({
          success: result.success,
          recorded: result.recorded,
          error: result.error
        })
        
      case 'invoice_generate':
        result = await generateInvoices()
        return NextResponse.json({
          success: result.success,
          generated: result.generated,
          skipped: result.skipped,
          error: result.error
        })
        
      case 'invoice_reminder':
        result = await sendInvoiceReminders()
        return NextResponse.json({
          success: result.success,
          sent: result.sent,
          skipped: result.skipped,
          error: result.error
        })
        
      case 'notification_check':
        const { NotificationService } = await import('@/lib/notifications')
        result = await NotificationService.runNotificationCheck()
        return NextResponse.json(result)
        
      case 'auto_isolir':
        result = await autoIsolateExpiredUsers()
        return NextResponse.json({
          success: result.success,
          isolated: result.isolated,
          error: result.error
        })
        
      case 'telegram_backup':
        const { autoBackupToTelegram } = await import('@/lib/cron/telegram-cron')
        result = await autoBackupToTelegram()
        return NextResponse.json({
          success: result.success,
          error: result.error
        })
        
      case 'telegram_health':
        const { sendHealthCheckToTelegram } = await import('@/lib/cron/telegram-cron')
        result = await sendHealthCheckToTelegram()
        return NextResponse.json({
          success: result.success,
          error: result.error
        })
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid job type'
        }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
