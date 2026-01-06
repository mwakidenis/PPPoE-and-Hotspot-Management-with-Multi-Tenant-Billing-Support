import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST - Agent login with phone number
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Find agent by phone
    const agent = await prisma.agent.findUnique({
      where: { phone },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found. Please contact administrator.' },
        { status: 404 }
      );
    }

    if (!agent.isActive) {
      return NextResponse.json(
        { error: 'Your account is inactive. Please contact administrator.' },
        { status: 403 }
      );
    }

    // Return agent data (in production, use JWT or session)
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        phone: agent.phone,
        email: agent.email,
      },
    });
  } catch (error) {
    console.error('Agent login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
