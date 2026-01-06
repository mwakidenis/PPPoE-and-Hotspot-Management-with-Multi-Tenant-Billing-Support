import { NextRequest, NextResponse } from 'next/server';
import { getAllPermissionsGrouped } from '@/lib/permissions';

/**
 * GET /api/permissions - Get all permissions grouped by category
 */
export async function GET(request: NextRequest) {
  try {
    const grouped = await getAllPermissionsGrouped();

    return NextResponse.json({
      success: true,
      permissions: grouped,
    });
  } catch (error: any) {
    console.error('Get permissions error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
