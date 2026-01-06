import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Get registration
    const registration = await prisma.registrationRequest.findUnique({
      where: { id },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending registrations can be rejected' },
        { status: 400 }
      );
    }

    // Update registration to rejected
    await prisma.registrationRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Registration rejected',
    });
  } catch (error: any) {
    console.error('Reject registration error:', error);
    return NextResponse.json(
      { error: 'Failed to reject registration' },
      { status: 500 }
    );
  }
}
