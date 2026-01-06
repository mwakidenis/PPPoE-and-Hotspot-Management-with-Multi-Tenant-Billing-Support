import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { disconnectExpiredSessions, disconnectPPPoEUser } from '@/lib/services/coaService'
import { nanoid } from 'nanoid'
import { startBackupCron, startHealthCron } from './telegram-cron'

let isRunning = false
let isAutoIsolirRunning = false

/**
 * Sync voucher status from RADIUS authentication logs
 */
export async function syncVoucherFromRadius(): Promise<{ success: boolean; synced: number; error?: string }> {
  if (isRunning) {
    return { success: false, synced: 0, error: 'Already running' }
  }

  isRunning = true
  const startedAt = new Date()
  
  // Create history record in database
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'voucher_sync',
      status: 'running',
      startedAt,
    },
  })

  try {
    let syncedCount = 0

    // Sync voucher status from radacct (WAITING -> ACTIVE)
    // Get WAITING vouchers that have active sessions in radacct
    const waitingVouchers = await prisma.hotspotVoucher.findMany({
      where: {
        status: 'WAITING',
      },
      select: {
        id: true,
        code: true,
        profile: true,
      },
    })

    for (const voucher of waitingVouchers) {
      // Check if voucher has an active session (first login)
      const activeSession = await prisma.radacct.findFirst({
        where: {
          username: voucher.code,
          acctstarttime: { not: null },
        },
        orderBy: {
          acctstarttime: 'asc', // Get first login
        },
      })

  if (activeSession && activeSession.acctstarttime) {
    // FreeRADIUS stores acctstarttime in WIB, and we store it as-is in database
    // No timezone conversion needed since DATABASE_URL has no timezone parameter
    // All datetime values are treated as WIB
    const firstLoginAt = activeSession.acctstarttime instanceof Date 
      ? activeSession.acctstarttime 
      : new Date(activeSession.acctstarttime)
    
    let expiresAtMs = firstLoginAt.getTime()        // Add validity time in milliseconds
        if (voucher.profile.validityUnit === 'MINUTES') {
          expiresAtMs += voucher.profile.validityValue * 60 * 1000
        } else if (voucher.profile.validityUnit === 'HOURS') {
          expiresAtMs += voucher.profile.validityValue * 60 * 60 * 1000
        } else if (voucher.profile.validityUnit === 'DAYS') {
          expiresAtMs += voucher.profile.validityValue * 24 * 60 * 60 * 1000
        } else if (voucher.profile.validityUnit === 'MONTHS') {
          // For months, use Date manipulation to handle month boundaries
          const expiresAt = new Date(firstLoginAt)
          expiresAt.setMonth(expiresAt.getMonth() + voucher.profile.validityValue)
          expiresAtMs = expiresAt.getTime()
        }
        
        const expiresAt = new Date(expiresAtMs)

        // Update voucher to ACTIVE with WIB timestamps
        const updatedVoucher = await prisma.hotspotVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'ACTIVE',
            firstLoginAt: firstLoginAt,
            expiresAt: expiresAt,
          },
          include: {
            profile: true,
            order: true,
          },
        })
        
        console.log(`[CRON] Voucher ${voucher.code} activated: firstLogin=${firstLoginAt.toISOString()}, expires=${expiresAt.toISOString()}`)
        
        // Auto-sync to Keuangan (only for manually generated vouchers, not e-voucher orders)
        if (!updatedVoucher.orderId) {
          try {
            const hotspotCategory = await prisma.transactionCategory.findFirst({
              where: { name: 'Pembayaran Hotspot', type: 'INCOME' },
            })

            if (hotspotCategory) {
              // Check if transaction already exists
              const existingTransaction = await prisma.transaction.findFirst({
                where: { reference: `VOUCHER-${updatedVoucher.code}` },
              })

              if (!existingTransaction) {
              await prisma.transaction.create({
                data: {
                  id: nanoid(),
                  categoryId: hotspotCategory.id,
                  type: 'INCOME',
                  amount: updatedVoucher.profile.costPrice,
                  description: `Voucher ${updatedVoucher.profile.name} - ${updatedVoucher.code} (Agent/Manual)`,
                  date: firstLoginAt,
                  reference: `VOUCHER-${updatedVoucher.code}`,
                  notes: `Auto-synced from voucher activation (costPrice: Rp ${updatedVoucher.profile.costPrice})`,
                },
              })
              console.log(`[CRON] Keuangan synced for voucher ${voucher.code}`)
              
              // If agent voucher, also record commission expense
              if (updatedVoucher.batchCode && updatedVoucher.batchCode.includes('-') && updatedVoucher.profile.resellerFee > 0) {
                const agentCategory = await prisma.transactionCategory.findFirst({
                  where: { name: 'Komisi Agent', type: 'EXPENSE' },
                })
                
                if (agentCategory) {
                  const existingCommission = await prisma.transaction.findFirst({
                    where: { reference: `COMMISSION-${updatedVoucher.code}` },
                  })
                  
                  if (!existingCommission) {
                    const agentName = updatedVoucher.batchCode.split('-')[0]
                    await prisma.transaction.create({
                      data: {
                        id: nanoid(),
                        categoryId: agentCategory.id,
                        type: 'EXPENSE',
                        amount: updatedVoucher.profile.resellerFee,
                        description: `Komisi Agent ${agentName} - Voucher ${updatedVoucher.code}`,
                        date: firstLoginAt,
                        reference: `COMMISSION-${updatedVoucher.code}`,
                        notes: `Agent commission for voucher ${updatedVoucher.profile.name}`,
                      },
                    })
                    console.log(`[CRON] Agent commission synced for voucher ${voucher.code} - Rp ${updatedVoucher.profile.resellerFee}`)
                  }
                }
              }
            }
          }
        } catch (keuanganError) {
          console.error(`[CRON] Keuangan sync error for ${voucher.code}:`, keuanganError)
        }
      }
      
      syncedCount++
      }
    }

    // Check and mark expired vouchers
    // IMPORTANT: Use raw SQL to avoid timezone conversion issues
    // Database stores datetime in WIB, so we compare directly with NOW()
    const expiredVouchers = await prisma.$queryRaw<Array<{code: string}>>`
      SELECT code FROM hotspot_vouchers
      WHERE status = 'ACTIVE'
        AND expiresAt < NOW()
    `

    // Remove expired vouchers from RADIUS tables
    for (const voucher of expiredVouchers) {
      await prisma.radcheck.deleteMany({
        where: { username: voucher.code }
      })
      await prisma.radusergroup.deleteMany({
        where: { username: voucher.code }
      })
    }

    // Update status to EXPIRED using raw SQL
    const expiredResult = await prisma.$executeRaw`
      UPDATE hotspot_vouchers
      SET status = 'EXPIRED'
      WHERE status = 'ACTIVE'
        AND expiresAt < NOW()
    `

    // Disconnect expired sessions via CoA
    let disconnectedCount = 0
    try {
      const coaResult = await disconnectExpiredSessions()
      disconnectedCount = coaResult.disconnected
    } catch (coaErr) {
      console.error('[CoA] Error:', coaErr)
    }

    // Update history in database
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Synced ${syncedCount} vouchers, expired ${expiredResult}, disconnected ${disconnectedCount} sessions`,
      },
    })

    return { success: true, synced: syncedCount }

  } catch (error: any) {
    console.error('Voucher sync error:', error)
    
    // Update history with error
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, synced: 0, error: error.message }
  } finally {
    isRunning = false
  }
}

/**
 * Record agent sales for active vouchers
 */
export async function recordAgentSales(): Promise<{ success: boolean; recorded: number; error?: string }> {
  const startedAt = new Date()
  
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'agent_sales',
      status: 'running',
      startedAt,
    },
  })

  try {
    // Get all ACTIVE vouchers that have agent batch codes (contains hyphen pattern)
    const activeVouchers = await prisma.hotspotVoucher.findMany({
      where: {
        status: 'ACTIVE',
        batchCode: {
          not: null,
        },
        firstLoginAt: {
          not: null,
        },
      },
      include: {
        profile: true,
      },
    })

    let recordedCount = 0

    for (const voucher of activeVouchers) {
      // Skip if batch code doesn't look like agent format (no hyphen)
      if (!voucher.batchCode?.includes('-')) {
        continue
      }

      // Check if sale already recorded
      const existingSale = await prisma.agentSale.findFirst({
        where: {
          voucherCode: voucher.code,
        },
      })

      if (existingSale) {
        continue // Already recorded
      }

      // Extract agent name from batch code (format: AGENTNAME-TIMESTAMP)
      const agentNamePattern = voucher.batchCode.split('-')[0]

      // Find agent by matching name pattern (case-insensitive for MySQL)
      const agent = await prisma.agent.findFirst({
        where: {
          name: {
            equals: agentNamePattern,
          },
        },
      })

      if (!agent) {
        continue // Skip if agent not found
      }

      try {
        // Record sale with resellerFee as agent profit
        await prisma.agentSale.create({
          data: {
            id: crypto.randomUUID(),
            agentId: agent.id,
            voucherCode: voucher.code,
            profileName: voucher.profile.name,
            amount: voucher.profile.resellerFee,
            createdAt: voucher.firstLoginAt!,
          },
        })

        recordedCount++
      } catch (error: any) {
        console.error(`Failed to record sale for ${voucher.code}:`, error.message)
      }
    }

    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Recorded ${recordedCount} agent sales`,
      },
    })

    return { success: true, recorded: recordedCount }
  } catch (error: any) {
    console.error('Agent sales recording error:', error)
    
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, recorded: 0, error: error.message }
  }
}

/**
 * Get cron history from database
 */
export async function getCronHistory(limit: number = 50) {
  return await prisma.cronHistory.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

/**
 * Initialize cron jobs
 */
export function initCronJobs() {
  // Run voucher sync every minute
  cron.schedule('* * * * *', async () => {
    console.log('[CRON] Running voucher sync...')
    const result = await syncVoucherFromRadius()
    console.log('[CRON] Voucher sync completed:', result)
  })

  // Run agent sales recording every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Running agent sales recording...')
    const result = await recordAgentSales()
    console.log('[CRON] Agent sales recording completed:', result)
  })

  // Run invoice generation daily at 7 AM
  cron.schedule('0 7 * * *', async () => {
    console.log('[CRON] Running invoice generation...')
    const result = await generateInvoices()
    console.log('[CRON] Invoice generation completed:', result)
  })

  // Run invoice reminder every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running invoice reminder check...')
    const result = await sendInvoiceReminders()
    console.log('[CRON] Invoice reminder completed:', result)
  })

  // Run auto-isolir expired users every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running auto-isolir for expired users...')
    const result = await autoIsolateExpiredUsers()
    console.log('[CRON] Auto-isolir completed:', result)
  })

  // Initialize Telegram backup & health check crons
  startBackupCron().catch(err => console.error('[CRON] Failed to start Telegram backup:', err))
  startHealthCron().catch(err => console.error('[CRON] Failed to start Telegram health:', err))

  console.log('[CRON] Jobs initialized: Voucher sync (every minute), Agent sales (every 5 minutes), Invoice generation (daily at 7 AM), Invoice reminders (hourly), Auto-isolir (hourly), Telegram backup & health check')
}

/**
 * Send invoice reminder WhatsApp notifications based on settings
 */
export async function sendInvoiceReminders(): Promise<{ success: boolean; sent: number; skipped: number; error?: string }> {
  const startedAt = new Date()
  
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'invoice_reminder',
      status: 'running',
      startedAt,
    },
  })

  try {
    // Get reminder settings
    const settings = await prisma.whatsapp_reminder_settings.findFirst()
    
    if (!settings || !settings.enabled) {
      const completedAt = new Date()
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: 'Reminder disabled, skipped',
        },
      })
      return { success: true, sent: 0, skipped: 0 }
    }
    
    const reminderDays: number[] = JSON.parse(settings.reminderDays)
    const [targetHour, targetMinute] = settings.reminderTime.split(':').map(Number)
    
    // Get current WIB time
    const now = new Date()
    const wibOffset = 7 * 60 // WIB is UTC+7
    const nowWIB = new Date(now.getTime() + wibOffset * 60 * 1000)
    const currentHour = nowWIB.getUTCHours()
    const currentMinute = nowWIB.getUTCMinutes()
    
    // Check if current time matches reminder time (within 1 hour window)
    if (currentHour !== targetHour) {
      const completedAt = new Date()
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: `Not time yet (current: ${currentHour}:${currentMinute}, target: ${targetHour}:${targetMinute})`,
        },
      })
      return { success: true, sent: 0, skipped: 0 }
    }
    
    let sentCount = 0
    let skippedCount = 0
    
    console.log(`[Invoice Reminder] Processing ${reminderDays.length} reminder schedules...`)
    
    // For each reminder day, find invoices that match
    for (const reminderDay of reminderDays) {
      // reminderDay is negative or 0: -5 means 5 days before due, 0 means due date
      // Calculate target due date: if reminderDay is -5, we want invoices due in 5 days from now
      const now = new Date()
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() - reminderDay) // Minus negative = add
      targetDate.setHours(0, 0, 0, 0)
      
      const nextDay = new Date(targetDate)
      nextDay.setDate(nextDay.getDate() + 1)
      
      console.log(`[Invoice Reminder] Checking H${reminderDay}: Looking for invoices due on ${targetDate.toISOString().split('T')[0]}`)
      
      // Find pending invoices with dueDate matching target
      const invoices = await prisma.invoice.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            gte: targetDate,
            lt: nextDay
          }
        },
        include: {
          user: {
            include: {
              profile: true
            }
          }
        }
      })
      
      console.log(`[Invoice Reminder] Found ${invoices.length} invoices for H${reminderDay}`)
      
      // Get company info once (shared for all invoices)
      const company = await prisma.company.findFirst()
      
      if (!company) {
        console.log(`[Invoice Reminder] No company info found, skipping ${invoices.length} invoices`)
        skippedCount += invoices.length
        continue
      }
      
      // Filter and prepare messages for batch sending with rate limiting
      const messagesToSend: Array<{
        phone: string
        message: string
        data: {
          invoice: typeof invoices[0]
          reminderDay: number
        }
      }> = []
      
      for (const invoice of invoices) {
        // Check if this reminder day already sent
        const sentReminders = invoice.sentReminders 
          ? JSON.parse(invoice.sentReminders) 
          : []
        
        if (sentReminders.includes(reminderDay)) {
          console.log(`[Invoice Reminder] Skipped ${invoice.invoiceNumber}: H${reminderDay} already sent`)
          skippedCount++
          continue
        }
        
        if (!invoice.customerPhone) {
          console.log(`[Invoice Reminder] Skipped ${invoice.invoiceNumber}: No customer phone`)
          skippedCount++
          continue
        }
        
        // Add to batch queue (we'll build message later in sendFunction)
        messagesToSend.push({
          phone: invoice.customerPhone,
          message: '', // Will be built in sendFunction
          data: { invoice, reminderDay }
        })
      }
      
      // Send messages with rate limiting (5 msg per 10 seconds)
      if (messagesToSend.length > 0) {
        console.log(`[Invoice Reminder] Sending ${messagesToSend.length} reminders with rate limiting...`)
        
        const { sendWithRateLimit, estimateSendTime, formatEstimatedTime } = await import('@/lib/utils/rateLimiter')
        const { sendInvoiceReminder } = await import('@/lib/whatsapp-notifications')
        
        const estimatedTime = estimateSendTime(messagesToSend.length)
        console.log(`[Invoice Reminder] Estimated time: ${formatEstimatedTime(estimatedTime)}`)
        
        const result = await sendWithRateLimit(
          messagesToSend,
          async (msg) => {
            const { invoice, reminderDay } = msg.data
            
            // Send WhatsApp reminder
            await sendInvoiceReminder({
              phone: invoice.customerPhone!,
              customerName: invoice.customerName || 'Customer',
              customerUsername: invoice.customerUsername || invoice.user?.username,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              paymentLink: invoice.paymentLink || '',
              companyName: company.name,
              companyPhone: company.phone || ''
            })
            
            // Mark this reminder as sent
            const sentReminders = invoice.sentReminders 
              ? JSON.parse(invoice.sentReminders) 
              : []
            sentReminders.push(reminderDay)
            
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                sentReminders: JSON.stringify(sentReminders)
              }
            })
          },
          {}, // Use default config: 5 msg/10sec
          (progress) => {
            console.log(`[Invoice Reminder] Progress: ${progress.current}/${progress.total} (Batch ${progress.batch}/${progress.totalBatches})`)
          }
        )
        
        sentCount += result.sent
        skippedCount += result.failed
        
        console.log(`[Invoice Reminder] Batch H${reminderDay} completed: ${result.sent} sent, ${result.failed} failed`)
      }
    }
    
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Sent ${sentCount} reminders, skipped ${skippedCount}`,
      },
    })
    
    return { success: true, sent: sentCount, skipped: skippedCount }
  } catch (error: any) {
    console.error('Invoice reminder error:', error)
    
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, sent: 0, skipped: 0, error: error.message }
  }
}

/**
 * Auto-isolir PPPoE users with expired expiredAt date
 * Runs every 1 hour to check and isolate expired users
 */
export async function autoIsolateExpiredUsers(): Promise<{ success: boolean; isolated: number; error?: string }> {
  if (isAutoIsolirRunning) {
    return { success: false, isolated: 0, error: 'Already running' }
  }

  isAutoIsolirRunning = true
  const startedAt = new Date()
  
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'auto_isolir',
      status: 'running',
      startedAt,
    },
  })

  try {
    // IMPORTANT: Use raw SQL to compare with NOW() directly
    // to avoid timezone conversion issues
    console.log(`[Auto Isolir] Checking for expired users...`)

    // Find active users with expiredAt before today
    const expiredUsers = await prisma.$queryRaw<Array<{
      id: string;
      username: string;
      password: string;
      status: string;
      expiredAt: Date;
      profileId: string;
      profile: any;
    }>>`
      SELECT u.*, p.id as profileId, p.name as profileName
      FROM pppoe_users u
      LEFT JOIN pppoe_profiles p ON u.profileId = p.id
      WHERE u.status = 'active'
        AND u.expiredAt < CURDATE()
    `

    if (expiredUsers.length === 0) {
      console.log('[Auto Isolir] No expired users found')
      
      const completedAt = new Date()
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: 'No expired users found',
        },
      })
      
      return { success: true, isolated: 0 }
    }

    console.log(`[Auto Isolir] Found ${expiredUsers.length} expired user(s) to isolate`)

    let isolatedCount = 0
    const errors: string[] = []

    for (const user of expiredUsers) {
      try {
        // Update user status to isolated
        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: { status: 'isolated' },
        })

        // Update RADIUS: move to isolir group
        // 1. Keep password in radcheck
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
          ON DUPLICATE KEY UPDATE value = ${user.password}
        `

        // 2. Move to isolir group (maps to MikroTik profile 'isolir')
        await prisma.$executeRaw`
          DELETE FROM radusergroup WHERE username = ${user.username}
        `
        await prisma.$executeRaw`
          INSERT INTO radusergroup (username, groupname, priority)
          VALUES (${user.username}, 'isolir', 1)
        `

        // 3. Remove static IP so user gets IP from MikroTik pool-isolir
        await prisma.$executeRaw`
          DELETE FROM radreply WHERE username = ${user.username} AND attribute = 'Framed-IP-Address'
        `

        // 4. Send CoA disconnect to force re-authentication
        const coaResult = await disconnectPPPoEUser(user.username)
        console.log(`[Auto Isolir] CoA disconnect for ${user.username}:`, coaResult.success ? 'Success' : 'Failed')

        isolatedCount++
        console.log(`✅ [Auto Isolir] User ${user.username} isolated (expired: ${user.expiredAt?.toISOString().split('T')[0]})`)
      } catch (error: any) {
        errors.push(`${user.username}: ${error.message}`)
        console.error(`❌ [Auto Isolir] Failed to isolate ${user.username}:`, error.message)
      }
    }

    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: errors.length === expiredUsers.length ? 'error' : 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Isolated ${isolatedCount}/${expiredUsers.length} expired users`,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      },
    })

    return { 
      success: true, 
      isolated: isolatedCount 
    }
  } catch (error: any) {
    console.error('[Auto Isolir] Error:', error)
    
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, isolated: 0, error: error.message }
  } finally {
    isAutoIsolirRunning = false
  }
}

/**
 * Generate invoices for users expiring in 7 days
 */
export async function generateInvoices(): Promise<{ success: boolean; generated: number; skipped: number; error?: string }> {
  const startedAt = new Date()
  
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'invoice_generate',
      status: 'running',
      startedAt,
    },
  })

  try {
    // Call internal API to generate invoices
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/invoices/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    
    const result = await response.json()
    
    if (result.success) {
      const completedAt = new Date()
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: `Generated ${result.generated} invoices, skipped ${result.skipped}`,
        },
      })
      
      return { 
        success: true, 
        generated: result.generated, 
        skipped: result.skipped 
      }
    } else {
      throw new Error(result.error || 'Failed to generate invoices')
    }
  } catch (error: any) {
    console.error('Invoice generation error:', error)
    
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, generated: 0, skipped: 0, error: error.message }
  }
}
