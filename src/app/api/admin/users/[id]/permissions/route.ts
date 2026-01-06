import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions, setUserPermissions, resetUserPermissionsToRole } from '@/lib/permissions';

/**
 * GET /api/admin/users/[id]/permissions - Get user's permissions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const permissions = await getUserPermissions(id);

    return NextResponse.json({
      success: true,
      permissions,
    });
  } catch (error: any) {
    console.error('Get user permissions error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users/[id]/permissions - Update user's custom permissions
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { permissions } = body;

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: 'Permissions must be an array' },
        { status: 400 }
      );
    }

    await setUserPermissions(id, permissions);

    return NextResponse.json({
      success: true,
      message: 'Permissions updated successfully',
    });
  } catch (error: any) {
    console.error('Update user permissions error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]/permissions - Reset to role template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await resetUserPermissionsToRole(id);

    return NextResponse.json({
      success: true,
      message: 'Permissions reset to role template',
    });
  } catch (error: any) {
    console.error('Reset user permissions error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
