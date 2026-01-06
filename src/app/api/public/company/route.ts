import { NextResponse } from 'next/server';
import { getCompanyInfo } from '@/lib/company';

export async function GET() {
  try {
    const company = await getCompanyInfo();
    
    return NextResponse.json({
      success: true,
      company: {
        name: company.name,
        logo: company.logo || null,
      }
    });
  } catch (error: any) {
    console.error('Get company error:', error);
    return NextResponse.json(
      { 
        success: true, 
        company: { name: 'AIBILL RADIUS', logo: null } 
      }
    );
  }
}
