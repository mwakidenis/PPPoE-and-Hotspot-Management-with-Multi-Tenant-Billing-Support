import midtransClient from 'midtrans-client'
import { prisma } from '@/lib/prisma'

export async function createMidtransPayment(params: {
  orderId: string
  amount: number
  customerName: string
  customerEmail?: string
  customerPhone: string
  invoiceToken: string
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
  }>
}) {
  // Get company base URL
  const company = await prisma.company.findFirst()
  const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Get Midtrans config
  const config = await prisma.paymentGateway.findUnique({
    where: { provider: 'midtrans' }
  })

  if (!config || !config.isActive) {
    throw new Error('Midtrans is not configured or inactive')
  }

  if (!config.midtransServerKey || !config.midtransClientKey) {
    throw new Error('Midtrans keys are not configured')
  }

  // Initialize Midtrans Snap
  const snap = new midtransClient.Snap({
    isProduction: config.midtransEnvironment === 'production',
    serverKey: config.midtransServerKey,
    clientKey: config.midtransClientKey
  })

  // Create transaction
  const parameter = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.amount
    },
    customer_details: {
      first_name: params.customerName,
      email: params.customerEmail || `${params.orderId}@customer.local`,
      phone: params.customerPhone
    },
    item_details: params.items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    callbacks: {
      finish: `${baseUrl}/payment/success?token=${params.invoiceToken}`,
      error: `${baseUrl}/payment/failed?token=${params.invoiceToken}`,
      pending: `${baseUrl}/payment/pending?token=${params.invoiceToken}`
    }
  }

  try {
    const transaction = await snap.createTransaction(parameter)
    return transaction
  } catch (error) {
    console.error('[Midtrans] Error creating payment:', error)
    throw error
  }
}
