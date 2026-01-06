import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvoiceReminder } from '@/lib/whatsapp-notifications'

/**
 * POST /api/invoices/send-reminder - Manually send WhatsApp invoice reminder
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId } = body

    if (!invoiceId) {
      return NextResponse.json({
        success: false,
        error: 'Invoice ID is required'
      }, { status: 400 })
    }

    // Get invoice with user details
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({
        success: false,
        error: 'Invoice not found'
      }, { status: 404 })
    }

    // Validate customer phone
    if (!invoice.customerPhone) {
      return NextResponse.json({
        success: false,
        error: 'Customer phone number not found'
      }, { status: 400 })
    }

    // Get company info
    const company = await prisma.company.findFirst()

    if (!company) {
      return NextResponse.json({
        success: false,
        error: 'Company information not found'
      }, { status: 500 })
    }

    // Send WhatsApp reminder
    await sendInvoiceReminder({
      phone: invoice.customerPhone,
      customerName: invoice.customerName || invoice.customerUsername || 'Customer',
      customerUsername: invoice.customerUsername || invoice.user?.username,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      paymentLink: invoice.paymentLink || '',
      companyName: company.name,
      companyPhone: company.phone || ''
    })

    return NextResponse.json({
      success: true,
      message: 'WhatsApp reminder sent successfully'
    })
  } catch (error: any) {
    console.error('Send reminder error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to send WhatsApp reminder'
    }, { status: 500 })
  }
}
