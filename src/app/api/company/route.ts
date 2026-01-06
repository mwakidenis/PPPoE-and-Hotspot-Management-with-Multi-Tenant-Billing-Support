import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    
    if (!company) {
      // Return default if no company exists
      return NextResponse.json({
        name: 'AIBILL RADIUS',
        email: 'admin@aibill.com',
        phone: '+62 812-3456-7890',
        address: 'Jakarta, Indonesia',
        baseUrl: 'http://localhost:3000',
        adminPhone: '+62 812-3456-7890',
        logo: null,
      });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Check if company already exists
    const existingCompany = await prisma.company.findFirst();
    
    let company;
    if (existingCompany) {
      // Update existing
      company = await prisma.company.update({
        where: { id: existingCompany.id },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          baseUrl: data.baseUrl,
          adminPhone: data.adminPhone,
          logo: data.logo,
        },
      });
    } else {
      // Create new
      company = await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          baseUrl: data.baseUrl,
          adminPhone: data.adminPhone,
          logo: data.logo,
        },
      });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error('Error saving company:', error);
    return NextResponse.json(
      { error: 'Failed to save company settings' },
      { status: 500 }
    );
  }
}
