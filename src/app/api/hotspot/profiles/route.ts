import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncProfileToRadius } from '@/lib/hotspot-radius-sync'

export async function GET() {
  try {
    const profiles = await prisma.hotspotProfile.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ profiles })
  } catch (error) {
    console.error('Get profiles error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      costPrice,
      resellerFee,
      speed,
      groupProfile,
      sharedUsers,
      validityValue,
      validityUnit,
      agentAccess,
      eVoucherAccess,
    } = body

    // Validation
    if (!name || !costPrice || !speed || !validityValue || !validityUnit) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      )
    }

    // Calculate selling price
    const sellingPrice = parseInt(costPrice) + (parseInt(resellerFee) || 0)

    const profile = await prisma.hotspotProfile.create({
      data: {
        id: crypto.randomUUID(),
        name,
        costPrice: parseInt(costPrice),
        resellerFee: parseInt(resellerFee) || 0,
        sellingPrice,
        speed,
        groupProfile,
        sharedUsers: parseInt(sharedUsers) || 1,
        validityValue: parseInt(validityValue),
        validityUnit,
        agentAccess: agentAccess ?? true,
        eVoucherAccess: eVoucherAccess ?? true,
      },
    })

    // Auto-sync to RADIUS
    try {
      await syncProfileToRadius(profile.id)
    } catch (syncError) {
      console.error('RADIUS sync error:', syncError)
      // Don't fail the request if sync fails
    }

    return NextResponse.json({ profile }, { status: 201 })
  } catch (error: any) {
    console.error('Create profile error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Profile name already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      costPrice,
      resellerFee,
      speed,
      groupProfile,
      sharedUsers,
      validityValue,
      validityUnit,
      agentAccess,
      eVoucherAccess,
      isActive,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })
    }

    // Calculate selling price
    const sellingPrice = parseInt(costPrice) + (parseInt(resellerFee) || 0)

    const profile = await prisma.hotspotProfile.update({
      where: { id },
      data: {
        name,
        costPrice: parseInt(costPrice),
        resellerFee: parseInt(resellerFee) || 0,
        sellingPrice,
        speed,
        groupProfile,
        sharedUsers: parseInt(sharedUsers) || 1,
        validityValue: parseInt(validityValue),
        validityUnit,
        agentAccess,
        eVoucherAccess,
        isActive,
      },
    })

    // Auto-sync to RADIUS
    try {
      await syncProfileToRadius(profile.id)
    } catch (syncError) {
      console.error('RADIUS sync error:', syncError)
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error('Update profile error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Profile name already exists' }, { status: 400 })
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })
    }

    // Check if profile has vouchers
    const voucherCount = await prisma.hotspotVoucher.count({
      where: { profileId: id }
    })

    if (voucherCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete profile with ${voucherCount} associated voucher(s)` },
        { status: 400 }
      )
    }

    await prisma.hotspotProfile.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Profile deleted successfully' })
  } catch (error: any) {
    console.error('Delete profile error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
