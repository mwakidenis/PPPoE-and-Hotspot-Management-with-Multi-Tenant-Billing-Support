import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WhatsAppService } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Check if OTP is enabled
    const settings = await prisma.whatsapp_reminder_settings.findFirst();
    if (settings && !settings.otpEnabled) {
      return NextResponse.json(
        { success: false, error: 'OTP login is currently disabled' },
        { status: 403 }
      );
    }

    // Clean phone number
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('62')) {
      cleanPhone = '62' + cleanPhone;
    }

    // Find user by phone
    const user = await prisma.pppoeUser.findFirst({
      where: {
        OR: [
          { phone: phone },
          { phone: cleanPhone },
          { phone: '0' + cleanPhone.substring(2) }, // 08xxx format
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Phone number not registered' },
        { status: 404 }
      );
    }

    // Check rate limiting - max 3 OTP per 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentOTPs = await prisma.customerSession.count({
      where: {
        phone: cleanPhone,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentOTPs >= 3) {
      return NextResponse.json(
        { success: false, error: 'Too many OTP requests. Please try again in 15 minutes.' },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // OTP expiry (default 5 minutes)
    const otpExpiry = new Date(Date.now() + (settings?.otpExpiry || 5) * 60 * 1000);

    // Save OTP to database
    await prisma.customerSession.create({
      data: {
        userId: user.id,
        phone: cleanPhone,
        otpCode,
        otpExpiry,
        verified: false,
      },
    });

    // Get company name
    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'AIBILL RADIUS';

    // Send OTP via WhatsApp
    const message = `Kode OTP Anda: ${otpCode}\n\nBerlaku ${settings?.otpExpiry || 5} menit.\nJangan bagikan kode ini kepada siapapun.\n\n- ${companyName}\n\n By AIBILL RADIUS`;

    try {
      await WhatsAppService.sendMessage({
        phone: cleanPhone,
        message,
      });

      return NextResponse.json({
        success: true,
        message: 'OTP sent successfully',
        expiresIn: settings?.otpExpiry || 5, // minutes
      });
    } catch (whatsappError: any) {
      console.error('WhatsApp send error:', whatsappError);
      
      // Delete the OTP session if WhatsApp failed
      await prisma.customerSession.deleteMany({
        where: {
          phone: cleanPhone,
          otpCode,
        },
      });

      return NextResponse.json(
        { success: false, error: 'Failed to send OTP. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
