import { prisma } from './prisma';

export async function getCompanyName(): Promise<string> {
  try {
    const company = await prisma.company.findFirst({
      select: { name: true }
    });
    return company?.name || 'AIBILL RADIUS';
  } catch (error) {
    console.error('Error fetching company name:', error);
    return 'AIBILL RADIUS';
  }
}

export async function getCompanyInfo() {
  try {
    const company = await prisma.company.findFirst();
    return company || {
      name: 'AIBILL RADIUS',
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    };
  } catch (error) {
    console.error('Error fetching company info:', error);
    return {
      name: 'AIBILL RADIUS',
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    };
  }
}
