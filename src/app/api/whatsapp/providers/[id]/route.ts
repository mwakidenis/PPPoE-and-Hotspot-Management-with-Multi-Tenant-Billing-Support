import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Update provider
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, type, apiKey, apiUrl, senderNumber, description, isActive, priority } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (apiKey !== undefined) updateData.apiKey = apiKey;
    if (apiUrl !== undefined) updateData.apiUrl = apiUrl;
    if (senderNumber !== undefined) updateData.senderNumber = senderNumber || null;
    if (description !== undefined) updateData.description = description || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (priority !== undefined) updateData.priority = priority;

    const provider = await prisma.whatsapp_providers.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(provider);
  } catch (error) {
    console.error('Failed to update provider:', error);
    return NextResponse.json(
      { error: 'Failed to update provider' },
      { status: 500 }
    );
  }
}

// DELETE - Delete provider
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await prisma.whatsapp_providers.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete provider:', error);
    return NextResponse.json(
      { error: 'Failed to delete provider' },
      { status: 500 }
    );
  }
}
