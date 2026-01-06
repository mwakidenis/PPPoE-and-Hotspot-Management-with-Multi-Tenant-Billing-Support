'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, DollarSign, FileText, CheckCircle, Clock, RefreshCw, Eye, AlertCircle, Copy, Check, ExternalLink, MessageCircle } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  userId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerUsername: string | null;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentToken: string | null;
  paymentLink: string | null;
  createdAt: string;
  user: {
    name: string;
    phone: string;
    email: string | null;
    username: string;
    profile: {
      name: string;
    } | null;
  } | null;
}

interface Stats {
  total: number;
  unpaid: number;
  paid: number;
  pending: number;
  overdue: number;
  totalUnpaidAmount: number;
  totalPaidAmount: number;
}

export default function InvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    unpaid: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    totalUnpaidAmount: 0,
    totalPaidAmount: 0,
  });
  const [activeTab, setActiveTab] = useState('unpaid');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingWA, setSendingWA] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, [activeTab]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      const res = await fetch(`/api/invoices?status=${status}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Load invoices error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsPaymentDialogOpen(true);
  };

  const confirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setProcessing(true);

    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedInvoice.id,
          status: 'PAID',
        }),
      });

      if (res.ok) {
        await showSuccess('Invoice marked as paid! User expiry extended.');
        setIsPaymentDialogOpen(false);
        loadInvoices();
      } else {
        const data = await res.json();
        await showError(data.error || 'Failed to mark as paid');
      }
    } catch (error) {
      console.error('Mark as paid error:', error);
      await showError('Failed to mark as paid');
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateInvoices = async () => {
    const confirmed = await showConfirm(
      'Generate monthly invoices for all active customers?',
      'Generate Invoices'
    );
    if (!confirmed) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/invoices/generate', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        await showSuccess(data.message, 'Invoices Generated');
        loadInvoices();
      } else {
        await showError(data.message || 'Failed to generate invoices');
      }
    } catch (error) {
      console.error('Generate invoices error:', error);
      await showError('Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const handleViewDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailDialogOpen(true);
  };

  const handleCopyPaymentLink = async (invoice: Invoice) => {
    if (!invoice.paymentLink) return;
    try {
      await navigator.clipboard.writeText(invoice.paymentLink);
      setCopiedId(invoice.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('Payment link copied!', 'success');
    } catch (error) {
      showToast('Failed to copy payment link', 'error');
    }
  };

  const handleSendWhatsApp = async (invoice: Invoice) => {
    if (!invoice.customerPhone) {
      await showError('Customer phone number not found');
      return;
    }

    const confirmed = await showConfirm(
      `Send invoice reminder to ${invoice.customerName || invoice.customerUsername}?`,
      'Send WhatsApp'
    );
    if (!confirmed) return;

    setSendingWA(invoice.id);
    try {
      const res = await fetch('/api/invoices/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });

      const data = await res.json();

      if (data.success) {
        await showSuccess('WhatsApp reminder sent successfully!');
      } else {
        await showError(data.error || 'Failed to send WhatsApp');
      }
    } catch (error) {
      console.error('Send WhatsApp error:', error);
      await showError('Failed to send WhatsApp reminder');
    } finally {
      setSendingWA(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    // Convert UTC date from DB to WIB for display
    return formatWIB(new Date(dateStr), 'd MMM yyyy');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Paid</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Pending</Badge>;
      case 'OVERDUE':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">Overdue</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Invoices
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage customer invoices and payments
          </p>
        </div>
        <Button
          onClick={handleGenerateInvoices}
          disabled={generating}
          className="flex items-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Generate Invoices
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Invoices
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Unpaid
            </CardTitle>
            <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unpaid}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrency(Number(stats.totalUnpaidAmount))}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Paid
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.paid}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrency(Number(stats.totalPaidAmount))}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Pending
            </CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table with Tabs */}
      <Card className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50">
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
          <CardDescription>View and manage customer invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={activeTab === 'unpaid' ? 'default' : 'outline'}
              onClick={() => setActiveTab('unpaid')}
              size="sm"
            >
              Unpaid ({stats.unpaid})
            </Button>
            <Button
              variant={activeTab === 'paid' ? 'default' : 'outline'}
              onClick={() => setActiveTab('paid')}
              size="sm"
            >
              Paid ({stats.paid})
            </Button>
            <Button
              variant={activeTab === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveTab('all')}
              size="sm"
            >
              All ({stats.total})
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border border-gray-200/50 dark:border-gray-800/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 dark:text-gray-400 py-8">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.user?.name || invoice.customerName || 'Deleted User'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{invoice.user?.phone || invoice.customerPhone || '-'}</div>
                          {!invoice.user && (
                            <div className="text-xs text-red-500 dark:text-red-400 mt-0.5">(User deleted)</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.user?.profile?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(invoice.amount))}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(invoice.dueDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {invoice.paymentLink && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyPaymentLink(invoice)}
                              title="Copy Payment Link"
                            >
                              {copiedId === invoice.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetail(invoice)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && invoice.customerPhone && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendWhatsApp(invoice)}
                              disabled={sendingWA === invoice.id}
                              title="Send WhatsApp Reminder"
                            >
                              {sendingWA === invoice.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MessageCircle className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkAsPaid(invoice)}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Complete information for invoice {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Invoice Number</p>
                  <p className="font-mono font-medium">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedInvoice.status)}</div>
                </div>
              </div>

              <div className="border-t pt-4 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                <p className="font-medium">{selectedInvoice.user?.name || selectedInvoice.customerName || 'Deleted User'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedInvoice.user?.phone || selectedInvoice.customerPhone || '-'}</p>
                {selectedInvoice.user?.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedInvoice.user.email}</p>
                )}
                {!selectedInvoice.user && (
                  <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                    ⚠️ User has been deleted from system
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Package</p>
                  <p className="text-sm">{selectedInvoice.user?.profile?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(Number(selectedInvoice.amount))}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created Date</p>
                  <p className="text-sm">{formatDate(selectedInvoice.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
                  <p className="text-sm">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
              </div>

              {selectedInvoice.status === 'PAID' && selectedInvoice.paidAt && (
                <div className="border-t pt-4 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Paid At</p>
                  <p className="text-sm">{formatDate(selectedInvoice.paidAt)}</p>
                </div>
              )}

              {selectedInvoice.paymentLink && (
                <div className="border-t pt-4 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Payment Link</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={selectedInvoice.paymentLink}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg font-mono"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyPaymentLink(selectedInvoice)}
                      title="Copy Link"
                    >
                      {copiedId === selectedInvoice.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(selectedInvoice.paymentLink!, '_blank')}
                      title="Open Link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
            <DialogDescription>
              Confirm payment for invoice {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmPayment} className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
              <p className="text-sm font-medium">{selectedInvoice?.user?.name || selectedInvoice?.customerName || 'Deleted User'}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Amount</p>
              <p className="text-lg font-bold">{formatCurrency(Number(selectedInvoice?.amount || 0))}</p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                ℹ️ User's expiry date will be automatically extended based on their profile validity period.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPaymentDialogOpen(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
