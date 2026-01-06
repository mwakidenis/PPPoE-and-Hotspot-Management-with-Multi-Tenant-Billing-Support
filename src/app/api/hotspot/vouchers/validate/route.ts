import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/hotspot/vouchers/validate
 * Validate voucher expiry by calling MySQL stored function
 * This can be called:
 * - When user views voucher page
 * - As a cron job
 * - After RADIUS accounting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, validateAll } = body

    if (validateAll) {
      // Check and update expired vouchers (without triggering firstLogin)
      const now = new Date()
      
      const expired = await prisma.hotspotVoucher.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            lt: now
          }
        },
        data: {
          status: 'EXPIRED'
        }
      })

      return NextResponse.json({
        success: true,
        expired_count: expired.count
      })
    }

    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'Code is required'
      }, { status: 400 })
    }

    // Check single voucher status (without triggering firstLogin)
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { code },
      include: { profile: true }
    })

    if (!voucher) {
      return NextResponse.json({
        success: false,
        error: 'Voucher not found'
      }, { status: 404 })
    }

    // Check if expired and update status
    const now = new Date()
    if (voucher.expiresAt && now > voucher.expiresAt && voucher.status === 'ACTIVE') {
      await prisma.hotspotVoucher.update({
        where: { id: voucher.id },
        data: { status: 'EXPIRED' }
      })
      voucher.status = 'EXPIRED'
    }

    const isValid = voucher.status === 'ACTIVE' || voucher.status === 'WAITING'

    return NextResponse.json({
      success: true,
      is_valid: isValid,
      voucher
    })

  } catch (error: any) {
    console.error('Validate voucher error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
