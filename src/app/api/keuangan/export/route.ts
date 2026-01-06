import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel"; // excel or pdf
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const type = searchParams.get("type"); // INCOME, EXPENSE, or all

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 },
      );
    }

    // Prepare date filters
    const startFilter = new Date(startDate);
    const endFilter = new Date(endDate);
    endFilter.setHours(23, 59, 59, 999);

    // Build where clause
    const where: any = {
      date: {
        gte: startFilter,
        lte: endFilter,
      },
    };

    if (type && type !== "all") {
      where.type = type;
    }

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    // Calculate stats
    const totalIncome = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalIncome - totalExpense;

    // Income breakdown by category
    const pppoeIncome = transactions
      .filter(
        (t) => t.type === "INCOME" && t.category.name === "Pembayaran PPPoE",
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const pppoeCount = transactions.filter(
      (t) => t.type === "INCOME" && t.category.name === "Pembayaran PPPoE",
    ).length;

    const hotspotIncome = transactions
      .filter(
        (t) => t.type === "INCOME" && t.category.name === "Pembayaran Hotspot",
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const hotspotCount = transactions.filter(
      (t) => t.type === "INCOME" && t.category.name === "Pembayaran Hotspot",
    ).length;

    const installIncome = transactions
      .filter(
        (t) => t.type === "INCOME" && t.category.name === "Biaya Instalasi",
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const installCount = transactions.filter(
      (t) => t.type === "INCOME" && t.category.name === "Biaya Instalasi",
    ).length;

    if (format === "excel") {
      return exportToExcel(transactions, {
        startDate,
        endDate,
        totalIncome,
        totalExpense,
        balance,
        pppoeIncome,
        pppoeCount,
        hotspotIncome,
        hotspotCount,
        installIncome,
        installCount,
      });
    } else {
      return exportToPDF(transactions, {
        startDate,
        endDate,
        totalIncome,
        totalExpense,
        balance,
        pppoeIncome,
        pppoeCount,
        hotspotIncome,
        hotspotCount,
        installIncome,
        installCount,
      });
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 },
    );
  }
}

function exportToExcel(transactions: any[], stats: any) {
  // Prepare data for Excel
  const data = transactions.map((t) => ({
    Tanggal: new Date(t.date).toLocaleDateString("id-ID"),
    Deskripsi: t.description,
    Kategori: t.category.name,
    Tipe: t.type,
    Jumlah: Number(t.amount),
    Referensi: t.reference || "-",
    Catatan: t.notes || "-",
  }));

  // Add summary rows
  data.push({});
  data.push({
    Tanggal: "RINGKASAN",
    Deskripsi: "",
    Kategori: "",
    Tipe: "",
    Jumlah: "",
    Referensi: "",
    Catatan: "",
  });
  data.push({
    Tanggal: "Total Income",
    Deskripsi: "",
    Kategori: "",
    Tipe: "",
    Jumlah: stats.totalIncome,
    Referensi: "",
    Catatan: "",
  });
  data.push({
    Tanggal: "  - PPPoE",
    Deskripsi: "",
    Kategori: "",
    Tipe: "",
    Jumlah: stats.pppoeIncome || 0,
    Referensi: `${stats.pppoeCount || 0} transaksi`,
    Catatan: "",
  });
  data.push({
    Tanggal: "  - Hotspot",
    Deskripsi: "",
    Kategori: "",
    Tipe: "",
    Jumlah: stats.hotspotIncome || 0,
    Referensi: `${stats.hotspotCount || 0} transaksi`,
    Catatan: "",
  });
  data.push({
    Tanggal: "  - Instalasi",
    Deskripsi: "",
    Kategori: "",
    Tipe: "",
    Jumlah: stats.installIncome || 0,
    Referensi: `${stats.installCount || 0} transaksi`,
    Catatan: "",
  });
  data.push({
    Tanggal: "Total Expense",
    Deskripsi: "",
    Kategori: "",
    Tipe: "",
    Jumlah: stats.totalExpense,
    Referensi: "",
    Catatan: "",
  });
  data.push({
    Tanggal: "Net Balance",
    Deskripsi: "",
    Kategori: "",
    Tipe: "",
    Jumlah: stats.balance,
    Referensi: "",
    Catatan: "",
  });

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transaksi Keuangan");

  // Generate buffer
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  // Return as downloadable file
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan-Keuangan-${stats.startDate}-${stats.endDate}.xlsx"`,
    },
  });
}

function exportToPDF(transactions: any[], stats: any) {
  // For now, return Excel format with a note
  // Full PDF implementation would require jspdf + jspdf-autotable on client side
  // Or use a PDF generation service
  return NextResponse.json({
    message: "PDF export will be generated on client side",
    transactions,
    stats,
  });
}
