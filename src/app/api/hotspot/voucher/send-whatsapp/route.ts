import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WhatsAppService } from '@/lib/whatsapp'

export async function POST(request: Request) {
  try {
    const { phone, vouchers } = await request.json()

    if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
      return NextResponse.json({ error: 'No vouchers selected' }, { status: 400 })
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Get company info
    const company = await prisma.company.findFirst()
    const companyName = company?.name || 'AIBILL'
    const companyPhone = company?.phone || ''

    // Build voucher message
    let message = '🎟️ *Voucher Hotspot Internet*\n\n'
    message += `Halo! Berikut adalah voucher internet Anda:\n\n`
    message += `━━━━━━━━━━━━━━━━━━\n\n`
    
    vouchers.forEach((v: any, idx: number) => {
      message += `*Voucher ${idx + 1}*\n`
      message += `🔑 Code: *${v.code}*\n`
      message += `📦 Paket: ${v.profileName}\n`
      message += `💰 Harga: Rp ${v.price.toLocaleString('id-ID')}\n`
      message += `⏳ Masa Aktif: ${v.validity}\n\n`
    })

    message += `━━━━━━━━━━━━━━━━━━\n\n`
    message += `📌 *Cara Menggunakan:*\n`
    message += `1. Hubungkan ke WiFi hotspot kami\n`
    message += `2. Buka browser, akan muncul halaman login\n`
    message += `3. Masukkan kode voucher\n`
    message += `4. Klik Login dan nikmati internet!\n\n`
    message += `⚠️ *Penting:*\n`
    message += `• Voucher akan aktif setelah login pertama\n`
    message += `• Simpan kode voucher dengan baik\n`
    message += `• Masa aktif dihitung sejak login pertama\n\n`
    message += `📞 Butuh bantuan? Hubungi: ${companyPhone}\n\n`
    message += `Terima kasih! 🙏\n${companyName}`

    // Send WhatsApp
    await WhatsAppService.sendMessage({
      phone,
      message
    })

    return NextResponse.json({
      success: true,
      message: 'WhatsApp sent successfully'
    })
  } catch (error) {
    console.error('Send WhatsApp error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
