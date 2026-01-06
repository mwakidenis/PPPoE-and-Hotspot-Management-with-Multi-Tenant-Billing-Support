import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/lib/prisma'

const execAsync = promisify(exec)

/**
 * Send CoA Disconnect to NAS to force logout a user
 * Requires radclient to be installed: apt-get install freeradius-utils
 */
export async function sendCoADisconnect(
  username: string, 
  nasIpAddress: string, 
  nasSecret: string,
  sessionId?: string,
  framedIp?: string
) {
  try {
    // Create CoA disconnect packet with attributes for MikroTik
    // Format: Attribute = Value (with spaces around =)
    let coaAttributes = []
    
    // Primary identifier: User-Name
    coaAttributes.push(`User-Name = "${username}"`)
    
    // Alternative identifier: Framed-IP-Address (more reliable)
    if (framedIp) {
      coaAttributes.push(`Framed-IP-Address = ${framedIp}`)
    }
    
    // Optional: Acct-Session-Id (helps with matching)
    if (sessionId) {
      coaAttributes.push(`Acct-Session-Id = "${sessionId}"`)
    }
    
    const coaPacket = coaAttributes.join('\\n')
    
    // Send CoA Disconnect-Request using radclient
    // Port 3799 is CoA/DM port (not 1812 which is auth)
    const command = `printf "${coaPacket}\\n" | radclient -x ${nasIpAddress}:3799 disconnect ${nasSecret}`
    
    console.log(`[CoA] Sending disconnect: ${coaPacket}`)
    
    const { stdout, stderr } = await execAsync(command)
    
    console.log(`[CoA] Disconnect sent to ${username} at ${nasIpAddress}`)
    console.log(`[CoA] Response:`, stdout)
    
    return { success: true, message: stdout }
  } catch (error: any) {
    console.error(`[CoA] Error disconnecting ${username}:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Disconnect all expired sessions
 * This should run periodically (every minute via cron)
 */
export async function disconnectExpiredSessions() {
  try {
    console.log('[CoA] Checking for expired active sessions...')
    
    // Get all active sessions from radacct where user has no stop time
    const activeSessions = await prisma.radacct.findMany({
      where: {
        acctstoptime: null,
      },
      select: {
        username: true,
        nasipaddress: true,
        acctsessionid: true,
        framedipaddress: true,
      },
    })
    
    if (activeSessions.length === 0) {
      return { disconnected: 0 }
    }
    
    let disconnectedCount = 0
    
    for (const session of activeSessions) {
      try {
        // Check if voucher is expired
        const voucher = await prisma.hotspotVoucher.findUnique({
          where: { code: session.username },
        })
        
        if (!voucher || voucher.status !== 'EXPIRED') {
          continue // Not expired, skip
        }
        
        // Get NAS secret
        const nas = await prisma.router.findFirst({
          where: { nasname: session.nasipaddress },
        })
        
        if (!nas) {
          console.log(`[CoA] NAS not found for ${session.nasipaddress}`)
          continue
        }
        
        // Send CoA Disconnect with session ID and IP
        const result = await sendCoADisconnect(
          session.username, 
          session.nasipaddress, 
          nas.secret,
          session.acctsessionid,
          session.framedipaddress
        )
        
        if (result.success) {
          disconnectedCount++
          console.log(`[CoA] Disconnected expired session: ${session.username}`)
        }
      } catch (err: any) {
        console.error(`[CoA] Error processing session ${session.username}:`, err.message)
      }
    }
    
    console.log(`[CoA] Disconnected ${disconnectedCount} expired sessions`)
    
    return { disconnected: disconnectedCount }
  } catch (err) {
    console.error('[CoA] Disconnect error:', err)
    throw err
  }
}

/**
 * Disconnect PPPoE user session by username
 * Finds active session from radacct and sends CoA disconnect
 */
export async function disconnectPPPoEUser(username: string) {
  try {
    console.log(`[CoA] Disconnecting PPPoE user: ${username}`)
    
    // Find active session for this user
    const activeSession = await prisma.radacct.findFirst({
      where: {
        username: username,
        acctstoptime: null, // Still active
      },
      orderBy: {
        acctstarttime: 'desc', // Get most recent session
      },
    })
    
    if (!activeSession) {
      console.log(`[CoA] No active session found for ${username}`)
      return { success: true, message: 'No active session' }
    }
    
    // Get NAS configuration
    const nas = await prisma.router.findFirst({
      where: { 
        nasname: activeSession.nasipaddress 
      },
    })
    
    if (!nas) {
      console.log(`[CoA] NAS not found for ${activeSession.nasipaddress}`)
      return { success: false, error: 'NAS not configured' }
    }
    
    // Send CoA disconnect
    const result = await sendCoADisconnect(
      activeSession.username,
      activeSession.nasipaddress,
      nas.secret,
      activeSession.acctsessionid,
      activeSession.framedipaddress
    )
    
    if (result.success) {
      console.log(`[CoA] Successfully disconnected ${username}`)
    }
    
    return result
  } catch (error: any) {
    console.error(`[CoA] Error disconnecting PPPoE user ${username}:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Disconnect multiple PPPoE users
 */
export async function disconnectMultiplePPPoEUsers(usernames: string[]) {
  const results = await Promise.allSettled(
    usernames.map(username => disconnectPPPoEUser(username))
  )
  
  const disconnected = results.filter(r => r.status === 'fulfilled').length
  
  return {
    total: usernames.length,
    disconnected,
    failed: usernames.length - disconnected,
  }
}

export default {
  sendCoADisconnect,
  disconnectExpiredSessions,
  disconnectPPPoEUser,
  disconnectMultiplePPPoEUsers,
}
