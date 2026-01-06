import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/apiAuth';

/**
 * GET /api/admin/users - Get all admin users
 */
export async function GET(request: NextRequest) {
  // Check permission
  const authCheck = await requirePermission('users.view');
  if (!authCheck.authorized) return authCheck.response;

  try {
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        phone: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error: any) {
    console.error('Get admin users error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users - Create new admin user
 */
export async function POST(request: NextRequest) {
  // Check permission
  const authCheck = await requirePermission('users.create');
  if (!authCheck.authorized) return authCheck.response;

  try {
    const body = await request.json();
    const { username, email, password, name, role, phone, isActive } = body;

    // Validate required fields
    if (!username || !password || !name || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existing = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.adminUser.create({
      data: {
        username,
        email: email || null,
        password: hashedPassword,
        name,
        role,
        phone: phone || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        phone: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error('Create admin user error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
