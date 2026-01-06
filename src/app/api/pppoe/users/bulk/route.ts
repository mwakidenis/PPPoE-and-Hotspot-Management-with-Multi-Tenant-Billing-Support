import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    if (type === 'template') {
      // Download CSV template
      const template = `username,password,name,phone,email,address,ipAddress,expiredAt,latitude,longitude
user001,pass123,John Doe,08123456789,john@example.com,Jl. Example No. 123,10.10.10.2,2025-12-31,-6.200000,106.816666
user002,pass456,Jane Smith,08987654321,jane@example.com,Jl. Sample No. 456,,2026-01-15,,`;

      return new NextResponse(template, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="pppoe-users-template.csv"',
        },
      });
    } else if (type === 'export') {
      // Export all users to CSV
      const users = await prisma.pppoeUser.findMany({
        include: {
          profile: true,
          router: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Build CSV content with password
      let csv = 'username,password,name,phone,email,address,ipAddress,status,profile,router,expiredAt,latitude,longitude,createdAt\n';
      
      users.forEach(user => {
        const row = [
          user.username,
          user.password, // Include plaintext password for backup/recovery
          user.name,
          user.phone,
          user.email || '',
          (user.address || '').replace(/,/g, ';'), // Replace commas in address
          user.ipAddress || '',
          user.status,
          user.profile?.name || '',
          user.router?.name || 'Global',
          user.expiredAt ? new Date(user.expiredAt).toISOString().split('T')[0] : '',
          user.latitude || '',
          user.longitude || '',
          new Date(user.createdAt).toISOString().split('T')[0],
        ];
        csv += row.map(field => `"${field}"`).join(',') + '\n';
      });

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="pppoe-users-export-${new Date().toISOString().split('T')[0]}.csv"`,
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
    const profileId = formData.get('pppoeProfileId') as string;
    const routerId = formData.get('routerId') as string | null;

    if (!file || !profileId) {
      return NextResponse.json(
        { error: 'File and profile are required' },
        { status: 400 }
      );
    }

    // Verify profile exists
    const profile = await prisma.pppoeProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Verify router if provided
    if (routerId) {
      const router = await prisma.router.findUnique({
        where: { id: routerId },
      });

      if (!router) {
        return NextResponse.json(
          { error: 'Router not found' },
          { status: 404 }
        );
      }
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
    
    // Required columns
    const requiredColumns = ['username', 'password', 'name', 'phone'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missingColumns.join(', ')}` },
        { status: 400 }
      );
    }

    // Process data rows
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

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
        if (!rowData.username || !rowData.password || !rowData.name || !rowData.phone) {
          results.failed++;
          results.errors.push({
            line: i + 1,
            username: rowData.username || 'unknown',
            error: 'Missing required fields',
          });
          continue;
        }

        // Check if username already exists
        const existingUser = await prisma.pppoeUser.findUnique({
          where: { username: rowData.username },
        });

        if (existingUser) {
          results.failed++;
          results.errors.push({
            line: i + 1,
            username: rowData.username,
            error: 'Username already exists',
          });
          continue;
        }

        // Create user
        const userData: any = {
          id: randomUUID(),
          username: rowData.username,
          password: rowData.password,
          name: rowData.name,
          phone: rowData.phone,
          email: rowData.email || null,
          address: rowData.address || null,
          ipAddress: rowData.ipaddress || null,
          profileId: profileId,
          routerId: routerId || null,
          status: 'active',
        };

        // Add expiredAt if provided
        if (rowData.expiredat) {
          userData.expiredAt = new Date(rowData.expiredat);
        }

        // Add coordinates if provided
        if (rowData.latitude && rowData.longitude) {
          userData.latitude = parseFloat(rowData.latitude);
          userData.longitude = parseFloat(rowData.longitude);
        }

        const newUser = await prisma.pppoeUser.create({
          data: userData,
        });

        // Sync to RADIUS
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${newUser.username}, 'Cleartext-Password', ':=', ${newUser.password})
          ON DUPLICATE KEY UPDATE value = ${newUser.password}
        `;

        await prisma.$executeRaw`
          DELETE FROM radusergroup WHERE username = ${newUser.username}
        `;

        await prisma.$executeRaw`
          INSERT INTO radusergroup (username, groupname, priority)
          VALUES (${newUser.username}, ${profile.groupName}, 1)
        `;

        // Add static IP if provided
        if (newUser.ipAddress) {
          await prisma.$executeRaw`
            INSERT INTO radreply (username, attribute, op, value)
            VALUES (${newUser.username}, 'Framed-IP-Address', ':=', ${newUser.ipAddress})
            ON DUPLICATE KEY UPDATE value = ${newUser.ipAddress}
          `;
        }

        // Mark as synced
        await prisma.pppoeUser.update({
          where: { id: newUser.id },
          data: { syncedToRadius: true },
        });

        results.success++;
      } catch (error: any) {
        console.error(`Error processing line ${i + 1}:`, error);
        results.failed++;
        results.errors.push({
          line: i + 1,
          username: line.split(',')[0] || 'unknown',
          error: error.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import users' },
      { status: 500 }
    );
  }
}
