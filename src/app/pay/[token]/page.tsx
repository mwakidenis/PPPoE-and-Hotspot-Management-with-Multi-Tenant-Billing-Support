'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Clock, AlertCircle, CreditCard, Building2 } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
  paidAt: string | null;
  user: {
    profile: {
      name: string;
    } | null;
  } | null;
}

interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
}

interface CompanySetting {
  companyName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export default function PaymentPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [company, setCompany] = useState<CompanySetting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [token]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/by-token/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load invoice');
        return;
      }

      setInvoice(data.invoice);
      setPaymentGateways(data.paymentGateways || []);
      setCompany(data.company || null);
    } catch (err) {
      setError('Failed to load invoice');
      console.error('Load invoice error:', err);
    } finally {
      setLoading(false);
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
    return new Date(dateStr).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'OVERDUE':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handlePayment = async (gateway: string) => {
    if (!invoice) return;
    
    setProcessing(true);
    
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          gateway
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        await showError(data.error || 'Failed to create payment');
        return;
      }
      
      // Redirect to payment gateway
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        await showError('Payment URL not available');
      }
    } catch (error) {
      console.error('Payment error:', error);
      await showError('Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Invoice Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {error || 'The payment link is invalid or has expired.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If already paid, show success message
  if (invoice.status === 'PAID') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Received
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This invoice has been paid
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-left">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Invoice</span>
                <span className="font-mono font-medium">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Amount</span>
                <span className="font-bold text-green-600">{formatCurrency(invoice.amount)}</span>
              </div>
              {invoice.paidAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Paid At</span>
                  <span className="text-sm">{formatDate(invoice.paidAt)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Payment Invoice
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please review your invoice details below
          </p>
        </div>

        {/* Invoice Card */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Invoice Details</CardTitle>
              {getStatusBadge(invoice.status)}
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Invoice Number */}
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-gray-600 dark:text-gray-400">Invoice Number</span>
              <span className="font-mono font-bold text-lg">{invoice.invoiceNumber}</span>
            </div>

            {/* Customer Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                Customer Information
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Name</span>
                  <span className="font-medium">{invoice.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Phone</span>
                  <span className="font-medium">{invoice.customerPhone}</span>
                </div>
                {invoice.user?.profile?.name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Package</span>
                    <span className="font-medium">{invoice.user.profile.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Amount */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-2">Total Amount</p>
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(invoice.amount)}
              </p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Issue Date</p>
                <p className="text-sm font-medium">{formatDate(invoice.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Due Date</p>
                <p className="text-sm font-medium">{formatDate(invoice.dueDate)}</p>
              </div>
            </div>

            {/* Overdue Warning */}
            {invoice.status === 'OVERDUE' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 dark:text-red-300">
                      Payment Overdue
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      This invoice is past its due date. Please make payment as soon as possible to avoid service interruption.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {paymentGateways.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  No payment methods available at the moment.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Please contact administrator for payment instructions.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentGateways.map((gateway) => (
                  <Button
                    key={gateway.id}
                    onClick={() => handlePayment(gateway.provider)}
                    disabled={processing}
                    className="w-full h-auto py-4 flex items-center justify-between group hover:shadow-lg transition-all disabled:opacity-50"
                    variant="outline"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-base">{gateway.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {gateway.provider}
                        </p>
                      </div>
                    </div>
                    {processing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-sm text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                        Pay Now →
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Info Footer */}
        {company && (
          <Card className="mt-6 shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {company.companyName}
                </h3>
                {company.address && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    📍 {company.address}
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  {company.phone && (
                    <span>📞 {company.phone}</span>
                  )}
                  {company.email && (
                    <span>✉️ {company.email}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Footer Branding */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Secure payment powered by
          </p>
          <p className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AIBILLRADIUS
          </p>
        </div>
      </div>
    </div>
  );
}
