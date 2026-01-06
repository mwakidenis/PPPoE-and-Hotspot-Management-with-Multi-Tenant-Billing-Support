import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Get all payment gateway configs
export async function GET() {
  try {
    const configs = await prisma.paymentGateway.findMany({
      select: {
        id: true,
        provider: true,
        name: true,
        isActive: true,
        midtransClientKey: true,
        midtransServerKey: true,
        midtransEnvironment: true,
        xenditApiKey: true,
        xenditWebhookToken: true,
        xenditEnvironment: true,
        duitkuMerchantCode: true,
        duitkuApiKey: true,
        duitkuEnvironment: true,
      }
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error('Get payment gateway configs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment gateway configs' },
      { status: 500 }
    );
  }
}

// POST - Create or update payment gateway config
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, ...data } = body;

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Check if config exists
    const existing = await prisma.paymentGateway.findUnique({
      where: { provider }
    });

    let config;

    if (existing) {
      // Update existing config
      config = await prisma.paymentGateway.update({
        where: { provider },
        data
      });
    } else {
      // Create new config
      config = await prisma.paymentGateway.create({
        data: {
          id: crypto.randomUUID(),
          provider,
          name: provider.charAt(0).toUpperCase() + provider.slice(1),
          ...data
        }
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Save payment gateway config error:', error);
    return NextResponse.json(
      { error: 'Failed to save payment gateway config' },
      { status: 500 }
    );
  }
}
