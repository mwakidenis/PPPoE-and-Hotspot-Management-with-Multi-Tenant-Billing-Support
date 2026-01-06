import { NextRequest, NextResponse } from 'next/server';
import { getRolePermissions } from '@/lib/permissions';
import { AdminRole } from '@prisma/client';

/**
 * GET /api/permissions/role/[role] - Get permissions template for a role
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    const { role } = await params;
    const roleUpper = role.toUpperCase() as AdminRole;

    // Validate role
    const validRoles = Object.values(AdminRole);
    if (!validRoles.includes(roleUpper)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    const permissions = await getRolePermissions(roleUpper);

    return NextResponse.json({
      success: true,
      role: roleUpper,
      permissions,
    });
  } catch (error: any) {
    console.error('Get role permissions error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
