"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess, showError, showConfirm } from "@/lib/sweetalert";
import { formatWIB } from "@/lib/timezone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Edit,
  Trash2,
  Filter,
  Download,
  Calendar,
  Tag,
  BarChart3,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  description: string | null;
  _count?: {
    transactions: number;
  };
}

interface Transaction {
  id: string;
  categoryId: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  date: string;
  reference: string | null;
  notes: string | null;
  category: Category;
}

interface Stats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  incomeCount: number;
  expenseCount: number;
  pppoeIncome?: number;
  pppoeCount?: number;
  hotspotIncome?: number;
  hotspotCount?: number;
  installIncome?: number;
  installCount?: number;
}

export default function KeuanganPage() {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    incomeCount: 0,
    expenseCount: 0,
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Transaction Dialog
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [transactionForm, setTransactionForm] = useState({
    categoryId: "",
    type: "INCOME" as "INCOME" | "EXPENSE",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    reference: "",
    notes: "",
  });

  // Category Dialog
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    type: "INCOME" as "INCOME" | "EXPENSE",
    description: "",
  });

  const [processing, setProcessing] = useState(false);

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    // Reset and reload when filters change
    setPage(1);
    setTransactions([]);
    setHasMore(true);
    loadData(1, true);
  }, [filterType, filterCategory, startDate, endDate, debouncedSearch]);

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 100
      ) {
        if (!loading && !loadingMore && hasMore) {
          loadMoreData();
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, loadingMore, hasMore, page]);

  const loadData = async (pageNum = 1, reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Load transactions
      let url = `/api/keuangan/transactions?page=${pageNum}&limit=50`;
      if (filterType !== "all") url += `&type=${filterType}`;
      if (filterCategory !== "all") url += `&categoryId=${filterCategory}`;
      if (startDate && endDate)
        url += `&startDate=${startDate}&endDate=${endDate}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;

      const [transRes, catRes] = await Promise.all([
        fetch(url),
        fetch("/api/keuangan/categories"),
      ]);

      const transData = await transRes.json();
      const catData = await catRes.json();

      if (transData.success) {
        if (reset) {
          setTransactions(transData.transactions);
        } else {
          setTransactions((prev) => [...prev, ...transData.transactions]);
        }
        setStats(transData.stats);
        setTotal(transData.total || 0);
        setHasMore(transData.transactions.length === 50);
      }

      if (catData.success) {
        setCategories(catData.categories);
      }
    } catch (error) {
      console.error("Load data error:", error);
      await showError("Failed to load data");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreData = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(nextPage, false);
  };

  const handleAddTransaction = () => {
    setEditingTransaction(null);
    setTransactionForm({
      categoryId: "",
      type: "INCOME",
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      reference: "",
      notes: "",
    });
    setIsTransactionDialogOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTransactionForm({
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: new Date(transaction.date).toISOString().split("T")[0],
      reference: transaction.reference || "",
      notes: transaction.notes || "",
    });
    setIsTransactionDialogOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !transactionForm.categoryId ||
      !transactionForm.amount ||
      !transactionForm.description
    ) {
      await showError("Please fill all required fields");
      return;
    }

    setProcessing(true);
    try {
      const method = editingTransaction ? "PUT" : "POST";
      const body = editingTransaction
        ? { id: editingTransaction.id, ...transactionForm }
        : transactionForm;

      const res = await fetch("/api/keuangan/transactions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        await showSuccess(data.message);
        setIsTransactionDialogOpen(false);
        loadData();
      } else {
        await showError(data.error);
      }
    } catch (error) {
      console.error("Save transaction error:", error);
      await showError("Failed to save transaction");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    const confirmed = await showConfirm(
      `Delete transaction: ${transaction.description}?`,
      "Delete Transaction",
    );
    if (!confirmed) return;

    try {
      const res = await fetch(
        `/api/keuangan/transactions?id=${transaction.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (data.success) {
        await showSuccess(data.message);
        loadData();
      } else {
        await showError(data.error);
      }
    } catch (error) {
      console.error("Delete transaction error:", error);
      await showError("Failed to delete transaction");
    }
  };

  const handleAddCategory = () => {
    setCategoryForm({
      name: "",
      type: "INCOME",
      description: "",
    });
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name) {
      await showError("Category name is required");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/keuangan/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });

      const data = await res.json();

      if (data.success) {
        await showSuccess(data.message);
        setIsCategoryDialogOpen(false);
        loadData();
      } else {
        await showError(data.error);
      }
    } catch (error) {
      console.error("Save category error:", error);
      await showError("Failed to save category");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    // Convert UTC date from DB to WIB for display
    return formatWIB(new Date(date), 'd MMM yyyy');
  };

  const resetFilters = () => {
    setFilterType("all");
    setFilterCategory("all");
    setStartDate("");
    setEndDate("");
  };

  const handleExport = async (format: "excel" | "pdf") => {
    if (!startDate || !endDate) {
      await showError("Please select start and end date");
      return;
    }

    try {
      const url = `/api/keuangan/export?format=${format}&startDate=${startDate}&endDate=${endDate}&type=${filterType}`;

      if (format === "excel") {
        // Download Excel file
        window.open(url, "_blank");
      } else {
        // PDF - client side generation
        const res = await fetch(url);
        const data = await res.json();

        if (data.transactions) {
          generatePDF(data.transactions, data.stats);
        }
      }
    } catch (error) {
      console.error("Export error:", error);
      await showError("Failed to export data");
    }
  };

  const generatePDF = async (transactions: any[], stats: any) => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text("Laporan Keuangan", 14, 15);
    doc.setFontSize(10);
    doc.text(
      `Periode: ${formatDate(startDate)} - ${formatDate(endDate)}`,
      14,
      22,
    );

    // Table
    const tableData = transactions.map((t: any) => [
      formatDate(t.date),
      t.description,
      t.category.name,
      t.type,
      formatCurrency(t.amount),
    ]);

    autoTable(doc, {
      head: [["Tanggal", "Deskripsi", "Kategori", "Tipe", "Jumlah"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text(`Total Income: ${formatCurrency(stats.totalIncome)}`, 14, finalY);

    // Income breakdown
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(
      `  - PPPoE: ${formatCurrency(stats.pppoeIncome)} (${stats.pppoeCount}x)`,
      18,
      finalY + 5,
    );
    doc.text(
      `  - Hotspot: ${formatCurrency(stats.hotspotIncome)} (${stats.hotspotCount}x)`,
      18,
      finalY + 10,
    );
    doc.text(
      `  - Instalasi: ${formatCurrency(stats.installIncome)} (${stats.installCount}x)`,
      18,
      finalY + 15,
    );

    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text(
      `Total Expense: ${formatCurrency(stats.totalExpense)}`,
      14,
      finalY + 22,
    );
    doc.text(`Net Balance: ${formatCurrency(stats.balance)}`, 14, finalY + 29);

    // Save
    doc.save(`Laporan-Keuangan-${startDate}-${endDate}.pdf`);
  };

  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const setQuickDate = (type: "thisMonth" | "lastMonth" | "thisYear") => {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (type === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === "lastMonth") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }

    setStartDate(formatDateLocal(start));
    setEndDate(formatDateLocal(end));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Manajemen Keuangan
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track income & expenses untuk bisnis Anda
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAddCategory} variant="outline">
            <Tag className="w-4 h-4 mr-2" />
            Add Category
          </Button>
          <Button onClick={handleAddTransaction}>
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.totalIncome)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.incomeCount} transactions
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">PPPoE:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatCurrency(stats.pppoeIncome || 0)} (
                  {stats.pppoeCount || 0}x)
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  Hotspot:
                </span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatCurrency(stats.hotspotIncome || 0)} (
                  {stats.hotspotCount || 0}x)
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  Instalasi:
                </span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatCurrency(stats.installIncome || 0)} (
                  {stats.installCount || 0}x)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Expense
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(stats.totalExpense)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.expenseCount} transactions
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-l-4 ${stats.balance >= 0 ? "border-l-blue-500" : "border-l-orange-500"}`}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Net Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-2xl font-bold ${stats.balance >= 0 ? "text-blue-600" : "text-orange-600"}`}
                >
                  {formatCurrency(stats.balance)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Income - Expense</p>
              </div>
              <div
                className={`w-12 h-12 ${stats.balance >= 0 ? "bg-blue-100 dark:bg-blue-900/20" : "bg-orange-100 dark:bg-orange-900/20"} rounded-full flex items-center justify-center`}
              >
                <Wallet
                  className={`w-6 h-6 ${stats.balance >= 0 ? "text-blue-600" : "text-orange-600"}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDate("thisMonth")}
            >
              Bulan Ini
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDate("lastMonth")}
            >
              Bulan Lalu
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDate("thisYear")}
            >
              Tahun Ini
            </Button>
          </div>
          
          {/* Search Bar */}
          <div className="mb-4">
            <Label>Search</Label>
            <Input
              type="text"
              placeholder="Cari berdasarkan deskripsi atau reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("excel")}
                disabled={!startDate || !endDate}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!startDate || !endDate}
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
          {(!startDate || !endDate) && (
            <p className="text-xs text-gray-500 mt-2">
              * Pilih Start Date dan End Date untuk mengaktifkan export
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      No transactions found. Add your first transaction!
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(transaction.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {transaction.description}
                          </p>
                          {transaction.notes && (
                            <p className="text-xs text-gray-500 mt-1">
                              {transaction.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transaction.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.type === "INCOME"
                              ? "default"
                              : "destructive"
                          }
                          className={
                            transaction.type === "INCOME"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-red-100 text-red-800 hover:bg-red-100"
                          }
                        >
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span
                          className={
                            transaction.type === "INCOME"
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {transaction.type === "INCOME" ? "+" : "-"}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">
                          {transaction.reference || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTransaction(transaction)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTransaction(transaction)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Loading More Indicator */}
          {loadingMore && (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
            </div>
          )}
          
          {/* End of Data Indicator */}
          {!loading && !loadingMore && !hasMore && transactions.length > 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Semua data sudah ditampilkan ({transactions.length} dari {total} transaksi)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Dialog */}
      <Dialog
        open={isTransactionDialogOpen}
        onOpenChange={setIsTransactionDialogOpen}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? "Edit Transaction" : "Add Transaction"}
            </DialogTitle>
            <DialogDescription>
              {editingTransaction
                ? "Update transaction details"
                : "Add a new income or expense transaction"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTransaction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={transactionForm.type}
                  onValueChange={(value: "INCOME" | "EXPENSE") =>
                    setTransactionForm({ ...transactionForm, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="categoryId">Category *</Label>
                <Select
                  value={transactionForm.categoryId}
                  onValueChange={(value) =>
                    setTransactionForm({
                      ...transactionForm,
                      categoryId: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((cat) => cat.type === transactionForm.type)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Amount (IDR) *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={transactionForm.amount}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      amount: e.target.value,
                    })
                  }
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      date: e.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={transactionForm.description}
                onChange={(e) =>
                  setTransactionForm({
                    ...transactionForm,
                    description: e.target.value,
                  })
                }
                placeholder="e.g., Monthly subscription payment"
                required
              />
            </div>

            <div>
              <Label htmlFor="reference">Reference (Optional)</Label>
              <Input
                id="reference"
                value={transactionForm.reference}
                onChange={(e) =>
                  setTransactionForm({
                    ...transactionForm,
                    reference: e.target.value,
                  })
                }
                placeholder="e.g., Invoice #123, Payment ID"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={transactionForm.notes}
                onChange={(e) =>
                  setTransactionForm({
                    ...transactionForm,
                    notes: e.target.value,
                  })
                }
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransactionDialogOpen(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Transaction"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a new income or expense category
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div>
              <Label htmlFor="catName">Category Name *</Label>
              <Input
                id="catName"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                placeholder="e.g., Subscription, Salary, Utilities"
                required
              />
            </div>

            <div>
              <Label htmlFor="catType">Type *</Label>
              <Select
                value={categoryForm.type}
                onValueChange={(value: "INCOME" | "EXPENSE") =>
                  setCategoryForm({ ...categoryForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="catDescription">Description (Optional)</Label>
              <Textarea
                id="catDescription"
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    description: e.target.value,
                  })
                }
                placeholder="Category description..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCategoryDialogOpen(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Category"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
