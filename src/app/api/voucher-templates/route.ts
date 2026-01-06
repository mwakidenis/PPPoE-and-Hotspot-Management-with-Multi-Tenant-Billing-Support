import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all templates
export async function GET(request: NextRequest) {
  try {
    const templates = await prisma.voucherTemplate.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, htmlTemplate, isDefault, isActive } = body;

    if (!name || !htmlTemplate) {
      return NextResponse.json(
        { error: 'Name and htmlTemplate are required' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.voucherTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const template = await prisma.voucherTemplate.create({
      data: {
        id: crypto.randomUUID(),
        name,
        htmlTemplate,
        isDefault: isDefault || false,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
