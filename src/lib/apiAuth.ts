import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { hasPermission, isSuperAdmin } from './permissions';
import { NextResponse } from 'next/server';

/**
 * Check if user is authenticated
 */
export async function checkAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session,
    userId: (session.user as any).id,
  };
}

/**
 * Check if user has required permission
 * Super Admin bypasses all permission checks
 */
export async function checkPermission(userId: string, permissionKey: string) {
  // Check if Super Admin (has all permissions)
  const isSuper = await isSuperAdmin(userId);
  if (isSuper) {
    return { authorized: true };
  }

  // Check specific permission
  const hasAccess = await hasPermission(userId, permissionKey);
  
  if (!hasAccess) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Combined check: Auth + Permission
 * Usage in API routes:
 * 
 * const authCheck = await requirePermission('users.create');
 * if (!authCheck.authorized) return authCheck.response;
 */
export async function requirePermission(permissionKey: string) {
  // First check authentication
  const authCheck = await checkAuth();
  if (!authCheck.authorized) {
    return authCheck;
  }

  // Then check permission
  const permCheck = await checkPermission(authCheck.userId, permissionKey);
  if (!permCheck.authorized) {
    return permCheck;
  }

  return {
    authorized: true,
    session: authCheck.session,
    userId: authCheck.userId,
  };
}
