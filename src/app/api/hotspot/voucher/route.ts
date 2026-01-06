import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncBatchToRadius, removeVoucherFromRadius } from '@/lib/hotspot-radius-sync'

// Helper to generate random voucher code
function generateVoucherCode(length: number, prefix: string = ''): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude similar chars: 0, O, I, 1
  let code = prefix
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Helper to generate batch code
function generateBatchCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  return `BATCH-${year}${month}${day}-${time}`
}

// GET - List vouchers with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')
    const batchCode = searchParams.get('batchCode')
    const status = searchParams.get('status')

    const where: any = {}

    if (profileId) where.profileId = profileId
    if (batchCode) where.batchCode = batchCode
    if (status && ['WAITING', 'ACTIVE', 'EXPIRED'].includes(status)) {
      where.status = status
    }

    const vouchers = await prisma.hotspotVoucher.findMany({
      where,
      include: {
        profile: {
          select: {
            name: true,
            sellingPrice: true,
            validityValue: true,
            validityUnit: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // Limit to prevent large data loads
    })

    // Get unique batch codes for filter
    const batches = await prisma.hotspotVoucher.findMany({
      select: {
        batchCode: true,
      },
      distinct: ['batchCode'],
      orderBy: {
        batchCode: 'desc',
      },
    })

    return NextResponse.json({ 
      vouchers,
      batches: batches.map(b => b.batchCode).filter(Boolean),
    })
  } catch (error) {
    console.error('Get vouchers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Generate vouchers in batch
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      quantity,
      profileId,
      codeLength = 6,
      prefix = '',
    } = body

    // Validation
    if (!quantity || !profileId) {
      return NextResponse.json(
        { error: 'Quantity and Profile are required' },
        { status: 400 }
      )
    }

    if (quantity > 500) {
      return NextResponse.json(
        { error: 'Cannot generate more than 500 vouchers at once' },
        { status: 400 }
      )
    }

    // Check if profile exists
    const profile = await prisma.hotspotProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Generate batch code
    const batchCode = generateBatchCode()

    // Generate vouchers
    const codes = new Set<string>()
    const voucherData = []

    for (let i = 0; i < quantity; i++) {
      let code: string
      let attempts = 0
      
      // Generate unique code
      do {
        code = generateVoucherCode(codeLength, prefix)
        attempts++
        if (attempts > 100) {
          throw new Error('Failed to generate unique voucher codes. Try different prefix or length.')
        }
      } while (codes.has(code))
      
      codes.add(code)
      
      voucherData.push({
        id: crypto.randomUUID(),
        code,
        profileId,
        batchCode,
        status: 'WAITING' as const,
      })
    }

    // Bulk create vouchers using raw SQL to use MySQL NOW() for createdAt
    // This ensures createdAt is in WIB (server timezone) not UTC
    const values = voucherData.map(v => 
      `('${v.id}', '${v.code}', '${v.profileId}', '${v.status}', NOW(), NOW(), ${v.batchCode ? `'${v.batchCode}'` : 'NULL'})`
    ).join(',')
    
    await prisma.$executeRawUnsafe(`
      INSERT INTO hotspot_vouchers (id, code, profileId, status, createdAt, updatedAt, batchCode)
      VALUES ${values}
    `)
    
    const result = { count: voucherData.length }

    // Auto-sync to RADIUS
    try {
      const syncResult = await syncBatchToRadius(batchCode)
      console.log(`Synced ${syncResult.successCount}/${syncResult.total} vouchers to RADIUS`)
    } catch (syncError) {
      console.error('RADIUS sync error:', syncError)
      // Don't fail the request if sync fails
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      batchCode,
      message: `${result.count} vouchers generated and synced to RADIUS`,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Generate vouchers error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete voucher or batch
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const batchCode = searchParams.get('batchCode')

    if (!id && !batchCode) {
      return NextResponse.json(
        { error: 'Voucher ID or Batch Code required' },
        { status: 400 }
      )
    }

    if (batchCode) {
      // Get voucher codes before deletion
      const vouchersToDelete = await prisma.hotspotVoucher.findMany({
        where: { batchCode, status: 'WAITING' },
        select: { code: true }
      })

      // Delete entire batch (only WAITING vouchers)
      const result = await prisma.hotspotVoucher.deleteMany({
        where: { 
          batchCode, 
          status: 'WAITING' 
        }
      })

      // Remove from RADIUS
      for (const v of vouchersToDelete) {
        try {
          await removeVoucherFromRadius(v.code)
        } catch (error) {
          console.error(`Failed to remove ${v.code} from RADIUS:`, error)
        }
      }
      
      return NextResponse.json({
        message: `${result.count} unused vouchers deleted from batch`,
        count: result.count,
      })
    } else if (id) {
      // Delete single voucher
      const voucher = await prisma.hotspotVoucher.findUnique({
        where: { id },
      })

      if (!voucher) {
        return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      }

      if (voucher.status !== 'WAITING') {
        return NextResponse.json(
          { error: 'Cannot delete used/active voucher' },
          { status: 400 }
        )
      }

      await prisma.hotspotVoucher.delete({ where: { id } })

      // Remove from RADIUS
      try {
        await removeVoucherFromRadius(voucher.code)
      } catch (error) {
        console.error('Failed to remove from RADIUS:', error)
      }
      
      return NextResponse.json({ message: 'Voucher deleted successfully' })
    }
  } catch (error) {
    console.error('Delete voucher error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
