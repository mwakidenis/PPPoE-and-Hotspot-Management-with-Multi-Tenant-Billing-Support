import { PrismaClient } from '@prisma/client';
import { seedPermissions } from './seeds/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed permissions first
  await seedPermissions();

  // Setup isolir group in radgroupreply
  // This maps RADIUS group 'isolir' to MikroTik group/profile 'isolir'
  console.log('Setting up isolir group mapping...');
  
  // Delete existing isolir group entries
  await prisma.$executeRaw`
    DELETE FROM radgroupreply WHERE groupname = 'isolir'
  `;

  // Create mapping: RADIUS group 'isolir' -> MikroTik group 'isolir'
  await prisma.$executeRaw`
    INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
    ('isolir', 'Mikrotik-Group', ':=', 'isolir')
  `;

  console.log('✅ Isolir group mapped successfully!');

  // Verify the setup
  const isolirGroup = await prisma.$queryRaw`
    SELECT * FROM radgroupreply WHERE groupname = 'isolir'
  `;
  
  console.log('📋 Isolir group configuration:', isolirGroup);

  // Seed WhatsApp templates
  console.log('Seeding WhatsApp templates...');
  
  const templates = [
    {
      type: 'registration-approval',
      name: 'Persetujuan Pendaftaran',
      message: `Halo {{customerName}},

Pendaftaran Anda telah disetujui!

*Detail Akun:*
Username: {{username}}
Password: {{password}}
Paket: {{profileName}}
Biaya Instalasi: {{installationFee}}

Silakan lakukan pembayaran instalasi untuk aktivasi.

Terima kasih,
{{companyName}}
{{companyPhone}}`,
    },
    {
      type: 'installation-invoice',
      name: 'Invoice Instalasi',
      message: `Halo {{customerName}},

Berikut invoice instalasi Anda:

*Detail Invoice:*
No. Invoice: {{invoiceNumber}}
Jumlah: {{amount}}
Jatuh Tempo: {{dueDate}}

Link Pembayaran:
{{paymentLink}}

Terima kasih,
{{companyName}}
{{companyPhone}}`,
    },
    {
      type: 'admin-create-user',
      name: 'Admin Create User Manual',
      message: `Halo {{customerName}},

Akun internet Anda telah dibuat!

*Detail Akun:*
Username: {{username}}
Password: {{password}}
Paket: {{profileName}}

Silakan gunakan kredensial di atas untuk login.

Terima kasih,
{{companyName}}
{{companyPhone}}`,
    },
    {
      type: 'invoice-reminder',
      name: 'Invoice Bulanan / Jatuh Tempo',
      message: `Halo {{customerName}},

Tagihan internet Anda akan jatuh tempo.

*Detail Invoice:*
Username: {{username}}
No. Invoice: {{invoiceNumber}}
Jumlah: {{amount}}
Jatuh Tempo: {{dueDate}}
Sisa Waktu: {{daysRemaining}} hari

Link Pembayaran:
{{paymentLink}}

Terima kasih,
{{companyName}}
{{companyPhone}}`,
    },
    {
      type: 'payment-success',
      name: 'Pembayaran Berhasil',
      message: `Halo {{customerName}},

Pembayaran Anda telah berhasil!

*Detail Pembayaran:*
No. Invoice: {{invoiceNumber}}
Jumlah: {{amount}}

*Akun Aktif:*
Username: {{username}}
Password: {{password}}
Paket: {{profileName}}

Akun Anda sekarang aktif. Terima kasih!

{{companyName}}
{{companyPhone}}`,
    },
    {
      type: 'voucher-purchase-success',
      name: 'E-Voucher Purchase Success',
      message: `Halo {{customerName}},

Terima kasih telah membeli E-Voucher!

*Detail Pesanan*
Nomor Order: {{orderNumber}}
Paket: {{profileName}}
Jumlah: {{quantity}} voucher
Masa Berlaku: {{validity}}

*Kode Voucher Anda:*
{{voucherCodes}}

Simpan kode voucher ini dengan baik. Gunakan kode ini untuk login ke hotspot.

Terima kasih,
{{companyName}}
{{companyPhone}}`,
    },
  ];

  for (const template of templates) {
    await prisma.whatsapp_templates.upsert({
      where: { type: template.type },
      update: {
        name: template.name,
        message: template.message,
        isActive: true,
      },
      create: {
        id: crypto.randomUUID(),
        type: template.type,
        name: template.name,
        message: template.message,
        isActive: true,
      },
    });
    console.log(`  ✅ ${template.name}`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
