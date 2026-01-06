import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

// GET - List all providers
export async function GET() {
  try {
    const providers = await prisma.whatsapp_providers.findMany({
      orderBy: { priority: 'asc' },
    });

    return NextResponse.json(providers);
  } catch (error) {
    console.error('Failed to fetch providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers' },
      { status: 500 }
    );
  }
}

// POST - Create new provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, apiKey, apiUrl, senderNumber, description, isActive, priority } = body;

    if (!name || !type || !apiKey || !apiUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const provider = await prisma.whatsapp_providers.create({
      data: {
        id: nanoid(),
        name,
        type,
        apiKey,
        apiUrl,
        senderNumber: senderNumber || null,
        description: description || null,
        isActive: isActive ?? true,
        priority: priority ?? 0,
      },
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (error) {
    console.error('Failed to create provider:', error);
    return NextResponse.json(
      { error: 'Failed to create provider' },
      { status: 500 }
    );
  }
}
