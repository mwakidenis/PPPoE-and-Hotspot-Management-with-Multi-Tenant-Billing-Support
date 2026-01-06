import { prisma } from './prisma'

/**
 * Sync hotspot profile to RADIUS radgroupreply table
 */
export async function syncProfileToRadius(profileId: string) {
  try {
    const profile = await prisma.hotspotProfile.findUnique({
      where: { id: profileId }
    })

    if (!profile) {
      throw new Error('Profile not found')
    }

    const groupName = profile.groupProfile || `hs-${profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`

    // Delete existing entries for this group
    await prisma.radgroupreply.deleteMany({
      where: { groupname: groupName }
    })

    // Add rate-limit attribute
    await prisma.radgroupreply.create({
      data: {
        groupname: groupName,
        attribute: 'Mikrotik-Rate-Limit',
        op: ':=',
        value: profile.speed
      }
    })

    // Add shared-users attribute
    await prisma.radgroupreply.create({
      data: {
        groupname: groupName,
        attribute: 'Simultaneous-Use',
        op: ':=',
        value: profile.sharedUsers.toString()
      }
    })

    return { success: true, groupName }
  } catch (error) {
    console.error('Sync profile to RADIUS error:', error)
    throw error
  }
}

/**
 * Sync single voucher to RADIUS
 * Structure like production:
 * - radcheck: password only
 * - radusergroup: username -> unique group per voucher (hotspot-{profile}-{code})
 * - radgroupreply: unique group -> Mikrotik-Group + Rate-Limit + Session-Timeout
 */
export async function syncVoucherToRadius(voucherId: string) {
  try {
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { id: voucherId },
      include: { profile: true }
    })

    if (!voucher) {
      throw new Error('Voucher not found')
    }

    // Generate unique group name per voucher: hotspot-{profileName}-{voucherCode}
    const profileName = voucher.profile.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const uniqueGroupName = `hotspot-${profileName}-${voucher.code}`
    
    // MikroTik profile name from groupProfile or use default
    const mikrotikProfile = voucher.profile.groupProfile || 'AIBILL'

    // 1. Add to radcheck (password)
    await prisma.radcheck.upsert({
      where: {
        username_attribute: {
          username: voucher.code,
          attribute: 'Cleartext-Password'
        }
      },
      create: {
        username: voucher.code,
        attribute: 'Cleartext-Password',
        op: ':=',
        value: voucher.code
      },
      update: {
        value: voucher.code
      }
    })

    // 2. Add to radusergroup (unique group per voucher)
    await prisma.radusergroup.upsert({
      where: {
        username_groupname: {
          username: voucher.code,
          groupname: uniqueGroupName
        }
      },
      create: {
        username: voucher.code,
        groupname: uniqueGroupName,
        priority: 1
      },
      update: {
        priority: 1
      }
    })

    // 3. Create radgroupreply entries for this unique group
    // Delete old entries first
    await prisma.radgroupreply.deleteMany({
      where: { groupname: uniqueGroupName }
    })

    // Calculate session timeout in seconds
    let sessionTimeout = 0
    switch (voucher.profile.validityUnit) {
      case 'MINUTES':
        sessionTimeout = voucher.profile.validityValue * 60
        break
      case 'HOURS':
        sessionTimeout = voucher.profile.validityValue * 3600
        break
      case 'DAYS':
        sessionTimeout = voucher.profile.validityValue * 86400
        break
      case 'MONTHS':
        sessionTimeout = voucher.profile.validityValue * 30 * 86400
        break
    }

    // Add Mikrotik-Group (profile name in MikroTik)
    await prisma.radgroupreply.create({
      data: {
        groupname: uniqueGroupName,
        attribute: 'Mikrotik-Group',
        op: ':=',
        value: mikrotikProfile
      }
    })

    // Add Mikrotik-Rate-Limit
    await prisma.radgroupreply.create({
      data: {
        groupname: uniqueGroupName,
        attribute: 'Mikrotik-Rate-Limit',
        op: ':=',
        value: voucher.profile.speed
      }
    })

    // Add Session-Timeout
    await prisma.radgroupreply.create({
      data: {
        groupname: uniqueGroupName,
        attribute: 'Session-Timeout',
        op: ':=',
        value: sessionTimeout.toString()
      }
    })

    return { success: true, groupName: uniqueGroupName }
  } catch (error) {
    console.error('Sync voucher to RADIUS error:', error)
    throw error
  }
}

/**
 * Remove voucher from RADIUS
 * Also removes the unique radgroupreply entries
 */
export async function removeVoucherFromRadius(code: string) {
  try {
    // Get voucher to find group name
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { code },
      include: { profile: true }
    })

    if (voucher) {
      const profileName = voucher.profile.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const uniqueGroupName = `hotspot-${profileName}-${code}`
      
      // Remove from radgroupreply
      await prisma.radgroupreply.deleteMany({
        where: { groupname: uniqueGroupName }
      })
    }

    // Remove from radcheck
    await prisma.radcheck.deleteMany({
      where: { username: code }
    })

    // Remove from radusergroup
    await prisma.radusergroup.deleteMany({
      where: { username: code }
    })

    return { success: true }
  } catch (error) {
    console.error('Remove voucher from RADIUS error:', error)
    throw error
  }
}

/**
 * Sync batch of vouchers to RADIUS
 */
export async function syncBatchToRadius(batchCode: string) {
  try {
    const vouchers = await prisma.hotspotVoucher.findMany({
      where: { batchCode },
      include: { profile: true }
    })

    let successCount = 0
    const errors = []

    for (const voucher of vouchers) {
      try {
        await syncVoucherToRadius(voucher.id)
        successCount++
      } catch (error: any) {
        errors.push({ voucherId: voucher.id, error: error.message })
      }
    }

    return {
      total: vouchers.length,
      successCount,
      failedCount: errors.length,
      errors
    }
  } catch (error) {
    console.error('Sync batch to RADIUS error:', error)
    throw error
  }
}

