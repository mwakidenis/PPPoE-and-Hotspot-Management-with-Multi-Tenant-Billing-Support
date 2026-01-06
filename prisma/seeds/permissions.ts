import { PrismaClient, AdminRole } from '@prisma/client';

const prisma = new PrismaClient();

// Define all permissions with categories
export const PERMISSIONS = [
  // DASHBOARD
  { key: 'dashboard.view', name: 'View Dashboard', category: 'DASHBOARD', description: 'Access to main dashboard' },
  { key: 'dashboard.stats', name: 'View Statistics', category: 'DASHBOARD', description: 'View system statistics' },

  // USERS MANAGEMENT
  { key: 'users.view', name: 'View Users', category: 'USERS', description: 'View admin users list' },
  { key: 'users.create', name: 'Create Users', category: 'USERS', description: 'Create new admin users' },
  { key: 'users.edit', name: 'Edit Users', category: 'USERS', description: 'Edit admin users' },
  { key: 'users.delete', name: 'Delete Users', category: 'USERS', description: 'Delete admin users' },
  { key: 'users.permissions', name: 'Manage Permissions', category: 'USERS', description: 'Manage user permissions' },

  // CUSTOMERS (PPPoE Users)
  { key: 'customers.view', name: 'View Customers', category: 'CUSTOMERS', description: 'View customer list' },
  { key: 'customers.create', name: 'Create Customers', category: 'CUSTOMERS', description: 'Create new customers' },
  { key: 'customers.edit', name: 'Edit Customers', category: 'CUSTOMERS', description: 'Edit customer data' },
  { key: 'customers.delete', name: 'Delete Customers', category: 'CUSTOMERS', description: 'Delete customers' },
  { key: 'customers.isolate', name: 'Isolate Customers', category: 'CUSTOMERS', description: 'Isolate/suspend customers' },

  // INVOICES & BILLING
  { key: 'invoices.view', name: 'View Invoices', category: 'INVOICES', description: 'View invoice list' },
  { key: 'invoices.create', name: 'Create Invoices', category: 'INVOICES', description: 'Create new invoices' },
  { key: 'invoices.edit', name: 'Edit Invoices', category: 'INVOICES', description: 'Edit invoices' },
  { key: 'invoices.delete', name: 'Delete Invoices', category: 'INVOICES', description: 'Delete invoices' },
  { key: 'invoices.approve', name: 'Approve Payments', category: 'INVOICES', description: 'Approve payment transactions' },

  // REGISTRATIONS
  { key: 'registrations.view', name: 'View Registrations', category: 'REGISTRATIONS', description: 'View registration requests' },
  { key: 'registrations.approve', name: 'Approve Registrations', category: 'REGISTRATIONS', description: 'Approve registration requests' },
  { key: 'registrations.reject', name: 'Reject Registrations', category: 'REGISTRATIONS', description: 'Reject registration requests' },

  // NETWORK & ROUTERS
  { key: 'network.view', name: 'View Network', category: 'NETWORK', description: 'View network topology' },
  { key: 'network.edit', name: 'Edit Network', category: 'NETWORK', description: 'Edit network configuration' },
  { key: 'routers.view', name: 'View Routers', category: 'NETWORK', description: 'View router list' },
  { key: 'routers.manage', name: 'Manage Routers', category: 'NETWORK', description: 'Add/edit/delete routers' },
  { key: 'vpn.view', name: 'View VPN', category: 'NETWORK', description: 'View VPN configuration' },
  { key: 'vpn.manage', name: 'Manage VPN', category: 'NETWORK', description: 'Manage VPN clients/servers' },

  // HOTSPOT & VOUCHERS
  { key: 'hotspot.view', name: 'View Hotspot', category: 'HOTSPOT', description: 'View hotspot profiles' },
  { key: 'hotspot.manage', name: 'Manage Hotspot', category: 'HOTSPOT', description: 'Manage hotspot profiles' },
  { key: 'vouchers.view', name: 'View Vouchers', category: 'HOTSPOT', description: 'View voucher list' },
  { key: 'vouchers.generate', name: 'Generate Vouchers', category: 'HOTSPOT', description: 'Generate new vouchers' },
  { key: 'vouchers.delete', name: 'Delete Vouchers', category: 'HOTSPOT', description: 'Delete vouchers' },

  // REPORTS & ANALYTICS
  { key: 'reports.view', name: 'View Reports', category: 'REPORTS', description: 'Access to reports' },
  { key: 'reports.export', name: 'Export Reports', category: 'REPORTS', description: 'Export reports to file' },
  { key: 'reports.financial', name: 'Financial Reports', category: 'REPORTS', description: 'View financial reports' },
  { key: 'sessions.view', name: 'View Sessions', category: 'REPORTS', description: 'View active sessions' },

  // KEUANGAN (Financial Transactions)
  { key: 'keuangan.view', name: 'View Transactions', category: 'KEUANGAN', description: 'View financial transactions' },
  { key: 'keuangan.create', name: 'Create Transactions', category: 'KEUANGAN', description: 'Create financial transactions' },
  { key: 'keuangan.edit', name: 'Edit Transactions', category: 'KEUANGAN', description: 'Edit financial transactions' },
  { key: 'keuangan.delete', name: 'Delete Transactions', category: 'KEUANGAN', description: 'Delete financial transactions' },
  { key: 'keuangan.categories', name: 'Manage Categories', category: 'KEUANGAN', description: 'Manage transaction categories' },

  // WHATSAPP
  { key: 'whatsapp.view', name: 'View WhatsApp', category: 'WHATSAPP', description: 'View WhatsApp settings' },
  { key: 'whatsapp.send', name: 'Send WhatsApp', category: 'WHATSAPP', description: 'Send WhatsApp messages' },
  { key: 'whatsapp.broadcast', name: 'Broadcast WhatsApp', category: 'WHATSAPP', description: 'Send broadcast messages' },
  { key: 'whatsapp.templates', name: 'Manage Templates', category: 'WHATSAPP', description: 'Manage message templates' },
  { key: 'whatsapp.providers', name: 'Manage Providers', category: 'WHATSAPP', description: 'Manage WhatsApp providers' },

  // NOTIFICATIONS
  { key: 'notifications.view', name: 'View Notifications', category: 'NOTIFICATIONS', description: 'View system notifications' },
  { key: 'notifications.manage', name: 'Manage Notifications', category: 'NOTIFICATIONS', description: 'Manage notification settings' },

  // SETTINGS
  { key: 'settings.view', name: 'View Settings', category: 'SETTINGS', description: 'View system settings' },
  { key: 'settings.edit', name: 'Edit Settings', category: 'SETTINGS', description: 'Edit system settings' },
  { key: 'settings.company', name: 'Company Settings', category: 'SETTINGS', description: 'Edit company information' },
  { key: 'settings.payment', name: 'Payment Gateway', category: 'SETTINGS', description: 'Manage payment gateway' },
  { key: 'settings.genieacs', name: 'GenieACS Settings', category: 'SETTINGS', description: 'Manage GenieACS settings' },
  { key: 'settings.cron', name: 'Cron Settings', category: 'SETTINGS', description: 'Manage cron jobs' },
];

// Define role permission templates
export const ROLE_TEMPLATES: Record<AdminRole, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map(p => p.key), // All permissions

  FINANCE: [
    'dashboard.view',
    'dashboard.stats',
    'invoices.view',
    'invoices.create',
    'invoices.edit',
    'invoices.delete',
    'invoices.approve',
    'customers.view',
    'keuangan.view',
    'keuangan.create',
    'keuangan.edit',
    'keuangan.delete',
    'keuangan.categories',
    'reports.view',
    'reports.export',
    'reports.financial',
    'notifications.view',
  ],

  CUSTOMER_SERVICE: [
    'dashboard.view',
    'customers.view',
    'customers.create',
    'customers.edit',
    'customers.isolate',
    'invoices.view',
    'invoices.create',
    'registrations.view',
    'registrations.approve',
    'registrations.reject',
    'whatsapp.view',
    'whatsapp.send',
    'notifications.view',
    'hotspot.view',
    'vouchers.view',
    'vouchers.generate',
    'sessions.view',
  ],

  TECHNICIAN: [
    'dashboard.view',
    'customers.view',
    'network.view',
    'network.edit',
    'routers.view',
    'routers.manage',
    'vpn.view',
    'vpn.manage',
    'sessions.view',
    'notifications.view',
    'settings.genieacs',
  ],

  MARKETING: [
    'dashboard.view',
    'dashboard.stats',
    'customers.view',
    'registrations.view',
    'hotspot.view',
    'hotspot.manage',
    'vouchers.view',
    'vouchers.generate',
    'whatsapp.view',
    'whatsapp.send',
    'whatsapp.broadcast',
    'whatsapp.templates',
    'reports.view',
    'reports.export',
    'notifications.view',
  ],

  VIEWER: [
    'dashboard.view',
    'customers.view',
    'invoices.view',
    'registrations.view',
    'network.view',
    'hotspot.view',
    'vouchers.view',
    'reports.view',
    'sessions.view',
    'notifications.view',
  ],
};

export async function seedPermissions() {
  console.log('🔐 Seeding permissions...');

  // 1. Create all permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {
        name: perm.name,
        description: perm.description,
        category: perm.category,
        isActive: true,
      },
      create: {
        id: crypto.randomUUID(),
        key: perm.key,
        name: perm.name,
        description: perm.description,
        category: perm.category,
        isActive: true,
      },
    });
  }
  console.log(`  ✅ Created ${PERMISSIONS.length} permissions`);

  // 2. Create role permission templates
  for (const [role, permissionKeys] of Object.entries(ROLE_TEMPLATES)) {
    // Delete existing role permissions
    await prisma.rolePermission.deleteMany({
      where: { role: role as AdminRole },
    });

    // Create new role permissions
    for (const key of permissionKeys) {
      const permission = await prisma.permission.findUnique({
        where: { key },
      });

      if (permission) {
        await prisma.rolePermission.create({
          data: {
            id: crypto.randomUUID(),
            role: role as AdminRole,
            permissionId: permission.id,
          },
        });
      }
    }
    console.log(`  ✅ Role template: ${role} (${permissionKeys.length} permissions)`);
  }

  console.log('✅ Permissions seeded successfully!');
}
