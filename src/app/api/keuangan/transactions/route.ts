import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import { startOfDayWIBtoUTC, endOfDayWIBtoUTC } from "@/lib/timezone";

const prisma = new PrismaClient();

// GET - List transactions with filters & stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // INCOME, EXPENSE, or all
    const categoryId = searchParams.get("categoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Prepare date filters
    // User input is in WIB (YYYY-MM-DD format), convert to UTC for DB query
    let startFilter: Date | undefined;
    let endFilter: Date | undefined;
    if (startDate && endDate) {
      // Convert WIB date string to UTC Date for database query
      // startDate "2025-11-01" (WIB) → "2025-10-31 17:00:00" (UTC)
      startFilter = startOfDayWIBtoUTC(new Date(startDate + 'T00:00:00'));
      // endDate "2025-11-01" (WIB) → "2025-11-01 16:59:59" (UTC)
      endFilter = endOfDayWIBtoUTC(new Date(endDate + 'T23:59:59'));
    }

    // Build where clause
    const where: any = {};
    if (type && type !== "all") {
      where.type = type;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (startFilter && endFilter) {
      where.date = {
        gte: startFilter,
        lte: endFilter,
      };
    }
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { reference: { contains: search } },
        { notes: { contains: search } }
      ];
    }

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        date: "desc",
      },
      skip,
      take: limit,
    });

    const total = await prisma.transaction.count({ where });

    // Get stats - Total Income & Expense
    const incomeTotal = await prisma.transaction.aggregate({
      where: {
        type: "INCOME",
        ...(startFilter && endFilter
          ? {
              date: {
                gte: startFilter,
                lte: endFilter,
              },
            }
          : {}),
      },
      _sum: {
        amount: true,
      },
    });

    const expenseTotal = await prisma.transaction.aggregate({
      where: {
        type: "EXPENSE",
        ...(startFilter && endFilter
          ? {
              date: {
                gte: startFilter,
                lte: endFilter,
              },
            }
          : {}),
      },
      _sum: {
        amount: true,
      },
    });

    const totalIncome = incomeTotal._sum.amount || 0;
    const totalExpense = expenseTotal._sum.amount || 0;
    const balance = Number(totalIncome) - Number(totalExpense);

    // Get count by type
    const incomeCount = await prisma.transaction.count({
      where: { type: "INCOME" },
    });
    const expenseCount = await prisma.transaction.count({
      where: { type: "EXPENSE" },
    });

    // Get income breakdown by category
    const pppoeCategory = await prisma.transactionCategory.findFirst({
      where: { name: "Pembayaran PPPoE", type: "INCOME" },
    });
    const hotspotCategory = await prisma.transactionCategory.findFirst({
      where: { name: "Pembayaran Hotspot", type: "INCOME" },
    });
    const installCategory = await prisma.transactionCategory.findFirst({
      where: { name: "Biaya Instalasi", type: "INCOME" },
    });

    const pppoeIncome = await prisma.transaction.aggregate({
      where: {
        type: "INCOME",
        categoryId: pppoeCategory?.id,
        ...(startFilter && endFilter
          ? {
              date: {
                gte: startFilter,
                lte: endFilter,
              },
            }
          : {}),
      },
      _sum: { amount: true },
      _count: true,
    });

    const hotspotIncome = await prisma.transaction.aggregate({
      where: {
        type: "INCOME",
        categoryId: hotspotCategory?.id,
        ...(startFilter && endFilter
          ? {
              date: {
                gte: startFilter,
                lte: endFilter,
              },
            }
          : {}),
      },
      _sum: { amount: true },
      _count: true,
    });

    const installIncome = await prisma.transaction.aggregate({
      where: {
        type: "INCOME",
        categoryId: installCategory?.id,
        ...(startFilter && endFilter
          ? {
              date: {
                gte: startFilter,
                lte: endFilter,
              },
            }
          : {}),
      },
      _sum: { amount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      transactions,
      total,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalIncome: Number(totalIncome),
        totalExpense: Number(totalExpense),
        balance,
        incomeCount,
        expenseCount,
        pppoeIncome: Number(pppoeIncome._sum.amount || 0),
        pppoeCount: pppoeIncome._count,
        hotspotIncome: Number(hotspotIncome._sum.amount || 0),
        hotspotCount: hotspotIncome._count,
        installIncome: Number(installIncome._sum.amount || 0),
        installCount: installIncome._count,
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}

// POST - Create new transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId, type, amount, description, date, reference, notes } =
      body;

    if (!categoryId || !type || !amount || !description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify category exists
    const category = await prisma.transactionCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 },
      );
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        id: nanoid(),
        categoryId,
        type,
        amount: parseInt(amount),
        description,
        date: date ? new Date(date) : new Date(),
        reference: reference || null,
        notes: notes || null,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Transaction created successfully",
      transaction,
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create transaction" },
      { status: 500 },
    );
  }
}

// PUT - Update transaction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      categoryId,
      type,
      amount,
      description,
      date,
      reference,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Transaction ID required" },
        { status: 400 },
      );
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(categoryId && { categoryId }),
        ...(type && { type }),
        ...(amount && { amount: parseInt(amount) }),
        ...(description && { description }),
        ...(date && { date: new Date(date) }),
        ...(reference !== undefined && { reference }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Transaction updated successfully",
      transaction,
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update transaction" },
      { status: 500 },
    );
  }
}

// DELETE - Delete transaction
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Transaction ID required" },
        { status: 400 },
      );
    }

    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete transaction" },
      { status: 500 },
    );
  }
}
