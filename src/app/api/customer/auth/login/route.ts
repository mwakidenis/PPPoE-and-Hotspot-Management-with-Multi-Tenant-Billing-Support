import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

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
    const otpEnabled = settings?.otpEnabled ?? false;

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
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        expiredAt: true,
        profile: {
          select: {
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Phone number not registered' },
        { status: 404 }
      );
    }

    // If OTP is disabled, create session and return token
    if (!otpEnabled) {
      const token = nanoid(64);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.customerSession.create({
        data: {
          userId: user.id,
          phone: cleanPhone,
          token,
          expiresAt,
          verified: true,
          otpCode: null,
          otpExpiry: null,
        },
      });

      return NextResponse.json({
        success: true,
        otpEnabled: false,
        requireOTP: false,
        user,
        token,
      });
    }

    // If OTP is enabled, just return that OTP is required
    return NextResponse.json({
      success: true,
      otpEnabled: true,
      requireOTP: true,
      user: null,
      token: null,
    });
  } catch (error: any) {
    console.error('Login check error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
