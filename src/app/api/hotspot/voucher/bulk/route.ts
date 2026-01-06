import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncVoucherToRadius } from '@/lib/hotspot-radius-sync';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    if (type === 'template') {
      // Download CSV template
      const template = `code
HOTSPOT123
HOTSPOT456
HOTSPOT789`;

      return new NextResponse(template, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="hotspot-voucher-template.csv"',
        },
      });
    } else if (type === 'export') {
      // Export all vouchers to CSV
      const vouchers = await prisma.hotspotVoucher.findMany({
        include: {
          profile: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Build CSV content
      let csv = 'code,batchCode,profileName,status,firstLoginAt,expiresAt,lastUsedBy,createdAt\n';
      
      vouchers.forEach(voucher => {
        const row = [
          voucher.code,
          voucher.batchCode || '',
          voucher.profile?.name || '',
          voucher.status,
          voucher.firstLoginAt ? new Date(voucher.firstLoginAt).toISOString() : '',
          voucher.expiresAt ? new Date(voucher.expiresAt).toISOString() : '',
          voucher.lastUsedBy || '',
          new Date(voucher.createdAt).toISOString(),
        ];
        csv += row.map(field => `"${field}"`).join(',') + '\n';
      });

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hotspot-vouchers-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const profileId = formData.get('profileId') as string;
    const batchCode = formData.get('batchCode') as string;

    if (!file || !profileId) {
      return NextResponse.json(
        { error: 'File and profile are required' },
        { status: 400 }
      );
    }

    // Verify profile exists
    const profile = await prisma.hotspotProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Parse CSV file
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      );
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Required column
    if (!headers.includes('code')) {
      return NextResponse.json(
        { error: 'Missing required column: code' },
        { status: 400 }
      );
    }

    // Process data rows
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Generate batch code if not provided
    const finalBatchCode = batchCode || `IMPORT-${Date.now()}`;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Parse CSV line (handle quoted values)
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => 
          v.replace(/^"|"$/g, '').trim()
        ) || [];

        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        // Validate required fields
        if (!rowData.code) {
          results.failed++;
          results.errors.push({
            line: i + 1,
            code: 'unknown',
            error: 'Missing voucher code',
          });
          continue;
        }

        // Check if voucher code already exists
        const existingVoucher = await prisma.hotspotVoucher.findUnique({
          where: { code: rowData.code },
        });

        if (existingVoucher) {
          results.failed++;
          results.errors.push({
            line: i + 1,
            code: rowData.code,
            error: 'Voucher code already exists',
          });
          continue;
        }

        // Create voucher
        const newVoucher = await prisma.hotspotVoucher.create({
          data: {
            id: crypto.randomUUID(),
            code: rowData.code,
            batchCode: finalBatchCode,
            profileId: profileId,
            status: 'WAITING',
          },
        });

        // Sync to RADIUS using proper sync function
        try {
          await syncVoucherToRadius(newVoucher.id);
          console.log(`✅ Voucher ${newVoucher.code} synced to RADIUS`);
        } catch (radiusError) {
          console.error(`RADIUS sync error for ${newVoucher.code}:`, radiusError);
          // Don't fail the import if sync fails
        }

        results.success++;
      } catch (error: any) {
        console.error(`Error processing line ${i + 1}:`, error);
        results.failed++;
        results.errors.push({
          line: i + 1,
          code: line.split(',')[0] || 'unknown',
          error: error.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      batchCode: finalBatchCode,
      results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import vouchers' },
      { status: 500 }
    );
  }
}
