import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.INVOICE_ENCRYPTION_KEY || 'default-key-change-in-production'

export function encryptToken(data: { invoiceId: string; customerId?: string }): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return `${iv.toString('hex')}:${encrypted}`
}

export function decryptToken(encryptedToken: string): { customerId: string; invoiceId: string } | null {
  try {
    const [ivHex, encryptedHex] = encryptedToken.split(':')
    
    if (!ivHex || !encryptedHex) {
      return null
    }

    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
    const iv = Buffer.from(ivHex, 'hex')
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    const data = JSON.parse(decrypted)
    
    return {
      customerId: data.customerId,
      invoiceId: data.invoiceId
    }
  } catch (error) {
    console.error('Decrypt token error:', error)
    return null
  }
}
