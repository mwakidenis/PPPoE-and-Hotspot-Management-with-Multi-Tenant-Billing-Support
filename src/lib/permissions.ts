import { prisma } from './prisma';
import { AdminRole } from '@prisma/client';

/**
 * Get all permissions for a user
 * Logic: Check user's custom permissions first, fallback to role template
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  // 1. Get user with their role and custom permissions
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    include: {
      userPermissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!user) {
    return [];
  }

  // 2. If user has custom permissions, use those
  if (user.userPermissions.length > 0) {
    return user.userPermissions
      .filter((up) => up.permission.isActive)
      .map((up) => up.permission.key);
  }

  // 3. Otherwise, fallback to role template permissions
  return getRolePermissions(user.role);
}

/**
 * Get default permissions for a role (template)
 */
export async function getRolePermissions(role: AdminRole): Promise<string[]> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role },
    include: {
      permission: true,
    },
  });

  // Filter active permissions and map to keys
  return rolePermissions
    .filter((rp) => rp.permission.isActive)
    .map((rp) => rp.permission.key);
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  userId: string,
  permissionKey: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permissionKey);
}

/**
 * Check if a user has ANY of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissionKeys: string[]
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissionKeys.some((key) => permissions.includes(key));
}

/**
 * Check if a user has ALL of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissionKeys: string[]
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissionKeys.every((key) => permissions.includes(key));
}

/**
 * Get all permissions grouped by category
 */
export async function getAllPermissionsGrouped() {
  const permissions = await prisma.permission.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });

  // Group by category
  const grouped: Record<string, typeof permissions> = {};
  for (const perm of permissions) {
    if (!grouped[perm.category]) {
      grouped[perm.category] = [];
    }
    grouped[perm.category].push(perm);
  }

  return grouped;
}

/**
 * Set custom permissions for a user
 * This replaces all user permissions with the provided list
 */
export async function setUserPermissions(
  userId: string,
  permissionKeys: string[]
): Promise<void> {
  // Start transaction
  await prisma.$transaction(async (tx) => {
    // 1. Delete existing user permissions
    await tx.userPermission.deleteMany({
      where: { userId },
    });

    // 2. Get permission IDs
    const permissions = await tx.permission.findMany({
      where: {
        key: { in: permissionKeys },
        isActive: true,
      },
    });

    // 3. Create new user permissions
    const userPermissions = permissions.map((perm) => ({
      id: crypto.randomUUID(),
      userId,
      permissionId: perm.id,
    }));

    if (userPermissions.length > 0) {
      await tx.userPermission.createMany({
        data: userPermissions,
      });
    }
  });
}

/**
 * Reset user permissions to role template
 * Deletes all custom permissions for the user
 */
export async function resetUserPermissionsToRole(userId: string): Promise<void> {
  await prisma.userPermission.deleteMany({
    where: { userId },
  });
}

/**
 * Check if user is Super Admin (has all permissions)
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role === 'SUPER_ADMIN';
}
