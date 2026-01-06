import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { removeVoucherFromRadius } from '@/lib/hotspot-radius-sync'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Voucher IDs are required' },
        { status: 400 }
      )
    }

    // Get voucher codes before deletion
    const vouchers = await prisma.hotspotVoucher.findMany({
      where: { id: { in: ids } },
      select: { code: true }
    })

    // Delete vouchers
    const result = await prisma.hotspotVoucher.deleteMany({
      where: {
        id: { in: ids }
      }
    })

    // Remove from RADIUS
    for (const v of vouchers) {
      try {
        await removeVoucherFromRadius(v.code)
      } catch (error) {
        console.error(`Failed to remove ${v.code} from RADIUS:`, error)
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: result.count 
    })
  } catch (error) {
    console.error('Bulk delete vouchers error:', error)
    return NextResponse.json(
      { error: 'Failed to delete vouchers' },
      { status: 500 }
    )
  }
}
