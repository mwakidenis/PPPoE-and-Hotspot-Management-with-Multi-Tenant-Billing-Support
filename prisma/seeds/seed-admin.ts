import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding default super admin...');

  // Check if super admin already exists
  const existing = await prisma.adminUser.findUnique({
    where: { username: 'superadmin' },
  });

  if (existing) {
    console.log('✅ Super admin already exists');
    console.log('Username:', existing.username);
    console.log('Role:', existing.role);
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('aibillradius', 10);

  // Create super admin
  const admin = await prisma.adminUser.create({
    data: {
      username: 'superadmin',
      email: 'admin@aibill.com',
      password: hashedPassword,
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Super admin created successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Username: superadmin');
  console.log('Password: aibillradius');
  console.log('Email: admin@aibill.com');
  console.log('Role: SUPER_ADMIN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  Please change the password after first login!');
}

main()
  .catch((e) => {
    console.error('Error seeding admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
