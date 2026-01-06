import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public stats - no sensitive data
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 1 minute

export async function GET(request: NextRequest) {
  try {
    // Only show safe, marketing-friendly numbers
    const totalUsers = await prisma.pppoeUser.count({
      where: { status: 'active' }
    });

    const totalVouchers = await prisma.hotspotVoucher.count({
      where: { status: 'ACTIVE' }
    });

    // Round to nearest 10 for privacy
    const roundedUsers = Math.floor(totalUsers / 10) * 10;
    const roundedVouchers = Math.floor(totalVouchers / 10) * 10;

    return NextResponse.json({
      success: true,
      stats: {
        activeUsers: roundedUsers,
        activeVouchers: roundedVouchers,
        uptime: 99.9, // Hardcoded or from monitoring system
        coverage: "10+ Kelurahan", // Update as needed
        // NO revenue or sensitive business data
      }
    });
  } catch (error) {
    console.error("Public stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
