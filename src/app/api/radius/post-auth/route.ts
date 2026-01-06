import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";

/**
 * RADIUS Post-Auth Hook
 * Called after successful authentication to:
 * 1. Set firstLoginAt and expiresAt on first login
 * 2. Check if voucher is expired
 * 3. Update voucher status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, reply } = body;

    // Only process Access-Accept
    if (reply !== "Access-Accept") {
      return NextResponse.json({ success: true, action: "ignore" });
    }

    // Find voucher
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { code: username },
      include: { profile: true },
    });

    if (!voucher) {
      return NextResponse.json(
        {
          success: false,
          error: "Voucher not found",
        },
        { status: 404 },
      );
    }

    // Get current time - server is in WIB, store as-is
    // No timezone conversion since DATABASE_URL has no timezone parameter
    const now = new Date();    // Check if voucher is already expired
    if (voucher.expiresAt && now > voucher.expiresAt) {
      // Mark as expired and reject
      await prisma.hotspotVoucher.update({
        where: { id: voucher.id },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Voucher expired",
          action: "reject",
        },
        { status: 403 },
      );
    }

    // First login: set firstLoginAt and calculate expiresAt
    if (!voucher.firstLoginAt) {
      const { validityValue, validityUnit } = voucher.profile;

      // Calculate interval in milliseconds
      let intervalMs = 0;
      switch (validityUnit) {
        case "MINUTES":
          intervalMs = validityValue * 60 * 1000;
          break;
        case "HOURS":
          intervalMs = validityValue * 60 * 60 * 1000;
          break;
        case "DAYS":
          intervalMs = validityValue * 24 * 60 * 60 * 1000;
          break;
        case "MONTHS":
          // Approximate 30 days per month
          intervalMs = validityValue * 30 * 24 * 60 * 60 * 1000;
          break;
      }

      const expiresAt = new Date(now.getTime() + intervalMs);

      // Update using Prisma (will handle timezone properly)
      const updated = await prisma.hotspotVoucher.update({
        where: { id: voucher.id },
        data: {
          firstLoginAt: now,
          expiresAt,
          status: "ACTIVE",
        },
        select: { firstLoginAt: true, expiresAt: true },
      });

      // Auto-sync to Keuangan (realtime for manual/agent vouchers)
      if (!voucher.orderId) {
        try {
          const hotspotCategory = await prisma.transactionCategory.findFirst({
            where: { name: "Pembayaran Hotspot", type: "INCOME" },
          });

          if (hotspotCategory) {
            const existingTransaction = await prisma.transaction.findFirst({
              where: { reference: `VOUCHER-${voucher.code}` },
            });

            if (!existingTransaction) {
              await prisma.transaction.create({
                data: {
                  id: nanoid(),
                  categoryId: hotspotCategory.id,
                  type: "INCOME",
                  amount: voucher.profile.costPrice, // Use costPrice for actual income
                  description: `Voucher ${voucher.profile.name} - ${voucher.code} (Agent/Manual)`,
                  date: now,
                  reference: `VOUCHER-${voucher.code}`,
                  notes: `Realtime sync from first login (costPrice: Rp ${voucher.profile.costPrice})`,
                },
              });
              console.log(
                `[POST-AUTH] Keuangan synced: ${voucher.code} - Rp ${voucher.profile.costPrice}`,
              );

              // If agent voucher (has batchCode with agent name), record commission expense
              if (voucher.batchCode && voucher.batchCode.includes("-")) {
                const agentCategory =
                  await prisma.transactionCategory.findFirst({
                    where: { name: "Komisi Agent", type: "EXPENSE" },
                  });

                if (agentCategory && voucher.profile.resellerFee > 0) {
                  const agentName = voucher.batchCode.split("-")[0];
                  await prisma.transaction.create({
                    data: {
                      id: nanoid(),
                      categoryId: agentCategory.id,
                      type: "EXPENSE",
                      amount: voucher.profile.resellerFee,
                      description: `Komisi Agent ${agentName} - Voucher ${voucher.code}`,
                      date: now,
                      reference: `COMMISSION-${voucher.code}`,
                      notes: `Agent commission for voucher ${voucher.profile.name}`,
                    },
                  });
                  console.log(
                    `[POST-AUTH] Agent commission synced: ${voucher.code} - Rp ${voucher.profile.resellerFee}`,
                  );
                }
              }
            }
          }
        } catch (keuanganError) {
          console.error("[POST-AUTH] Keuangan sync error:", keuanganError);
        }
      }

      return NextResponse.json({
        success: true,
        action: "first_login",
        firstLoginAt: updated?.firstLoginAt,
        expiresAt: updated?.expiresAt,
      });
    }

    // Subsequent logins: just verify not expired
    return NextResponse.json({
      success: true,
      action: "allow",
      expiresAt: voucher.expiresAt,
    });
  } catch (error: any) {
    console.error("RADIUS post-auth error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
