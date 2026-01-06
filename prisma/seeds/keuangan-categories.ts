import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

export async function seedKeuanganCategories() {
  console.log('🌱 Seeding Keuangan Categories...');

  const categories = [
    // INCOME Categories
    {
      id: nanoid(),
      name: 'Pembayaran PPPoE',
      type: 'INCOME',
      description: 'Pendapatan dari pembayaran pelanggan PPPoE bulanan',
    },
    {
      id: nanoid(),
      name: 'Pembayaran Hotspot',
      type: 'INCOME',
      description: 'Pendapatan dari penjualan voucher hotspot',
    },
    {
      id: nanoid(),
      name: 'Biaya Instalasi',
      type: 'INCOME',
      description: 'Pendapatan dari biaya instalasi pelanggan baru',
    },
    {
      id: nanoid(),
      name: 'Pendapatan Lain-lain',
      type: 'INCOME',
      description: 'Pendapatan dari sumber lain',
    },

    // EXPENSE Categories
    {
      id: nanoid(),
      name: 'Bandwidth & Upstream',
      type: 'EXPENSE',
      description: 'Biaya bandwidth dan koneksi upstream',
    },
    {
      id: nanoid(),
      name: 'Gaji Karyawan',
      type: 'EXPENSE',
      description: 'Biaya gaji dan upah karyawan',
    },
    {
      id: nanoid(),
      name: 'Listrik',
      type: 'EXPENSE',
      description: 'Biaya listrik untuk operasional',
    },
    {
      id: nanoid(),
      name: 'Maintenance & Repair',
      type: 'EXPENSE',
      description: 'Biaya perawatan dan perbaikan perangkat',
    },
    {
      id: nanoid(),
      name: 'Peralatan & Hardware',
      type: 'EXPENSE',
      description: 'Pembelian peralatan dan hardware jaringan',
    },
    {
      id: nanoid(),
      name: 'Sewa Tempat',
      type: 'EXPENSE',
      description: 'Biaya sewa kantor atau tempat operasional',
    },
    {
      id: nanoid(),
      name: 'Komisi Agent',
      type: 'EXPENSE',
      description: 'Biaya komisi untuk agent voucher',
    },
    {
      id: nanoid(),
      name: 'Marketing & Promosi',
      type: 'EXPENSE',
      description: 'Biaya marketing, iklan, dan promosi',
    },
    {
      id: nanoid(),
      name: 'Operasional Lainnya',
      type: 'EXPENSE',
      description: 'Biaya operasional lainnya',
    },
  ];

  for (const category of categories) {
    const existing = await prisma.transactionCategory.findUnique({
      where: { name: category.name },
    });

    if (!existing) {
      await prisma.transactionCategory.create({
        data: category as any,
      });
      console.log(`  ✓ Created category: ${category.name}`);
    } else {
      console.log(`  ⊙ Category already exists: ${category.name}`);
    }
  }

  console.log('✅ Keuangan Categories seeding completed!\n');
}

// Run if called directly
if (require.main === module) {
  seedKeuanganCategories()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
