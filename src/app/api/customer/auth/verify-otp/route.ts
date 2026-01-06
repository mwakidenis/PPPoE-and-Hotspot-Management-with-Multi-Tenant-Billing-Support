import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const { phone, otpCode } = await request.json();

    if (!phone || !otpCode) {
      return NextResponse.json(
        { success: false, error: 'Phone and OTP code are required' },
        { status: 400 }
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

    // Find OTP session
    const session = await prisma.customerSession.findFirst({
      where: {
        phone: cleanPhone,
        otpCode: otpCode,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP code' },
        { status: 400 }
      );
    }

    // Check if OTP expired
    if (session.otpExpiry && new Date() > session.otpExpiry) {
      return NextResponse.json(
        { success: false, error: 'OTP code has expired' },
        { status: 400 }
      );
    }

    // Generate session token
    const token = nanoid(64);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Update session
    await prisma.customerSession.update({
      where: { id: session.id },
      data: {
        verified: true,
        token,
        expiresAt,
        otpCode: null, // Clear OTP after verification
        otpExpiry: null,
      },
    });

    // Get user details
    const user = await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
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

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token,
      expiresAt,
      user,
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
