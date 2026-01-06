'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Download, ArrowRight, Loader2, Calendar, User, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  paidAt: string | null;
  dueDate: string;
  customerName: string | null;
  customerPhone: string | null;
  customerUsername: string | null;
  user: {
    name: string;
    phone: string;
    username: string;
    expiredAt: string | null;
  } | null;
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchInvoiceStatus();
    } else {
      setError('Token pembayaran tidak ditemukan');
      setLoading(false);
    }
  }, [token]);

  const fetchInvoiceStatus = async () => {
    try {
      const res = await fetch(`/api/invoices/check?token=${token}`);
      const data = await res.json();

      if (res.ok && data.invoice) {
        setInvoice(data.invoice);
      } else {
        setError(data.error || 'Invoice tidak ditemukan');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Gagal mengecek status pembayaran');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Mengecek status pembayaran...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Oops!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all transform hover:scale-105"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'PAID';
  const customerName = invoice.user?.name || invoice.customerName || 'Customer';
  const customerPhone = invoice.user?.phone || invoice.customerPhone || '-';
  const expiryDate = invoice.user?.expiredAt;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Animation */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-block relative">
            <div className="absolute inset-0 bg-green-400 rounded-full opacity-20 animate-ping"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
              <CheckCircle2 className="w-14 h-14 text-white animate-scale-in" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent mt-6 mb-2 animate-slide-up">
            Pembayaran Berhasil! 🎉
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 text-lg animate-slide-up animation-delay-100">
            {isPaid ? 'Invoice Anda telah terbayar' : 'Pembayaran sedang diproses'}
          </p>
        </div>

        {/* Invoice Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden mb-6 animate-slide-up animation-delay-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Invoice</span>
              {isPaid && (
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold">
                  LUNAS
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold">#{invoice.invoiceNumber}</h2>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Amount */}
            <div className="text-center py-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Pembayaran</p>
              <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                {formatCurrency(invoice.amount)}
              </p>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pelanggan</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{customerName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{customerPhone}</p>
                </div>
              </div>

              {invoice.paidAt && (
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tanggal Pembayaran</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {new Date(invoice.paidAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              )}

              {expiryDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Masa Aktif Sampai</p>
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {new Date(expiryDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Success Message */}
            {isPaid && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <p className="text-sm text-green-800 dark:text-green-300 text-center">
                  ✅ Layanan Anda telah diaktifkan kembali
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up animation-delay-300">
          <button
            onClick={() => router.push(`/pay/${token}`)}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-all transform hover:scale-105"
          >
            <Download className="w-5 h-5" />
            <span className="font-semibold">Lihat Invoice</span>
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl shadow-lg shadow-green-500/30 transition-all transform hover:scale-105"
          >
            <span className="font-semibold">Selesai</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400 animate-fade-in animation-delay-400">
          <p>Terima kasih atas pembayaran Anda! 🙏</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scale-in {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .animation-delay-100 {
          animation-delay: 0.1s;
          animation-fill-mode: backwards;
        }
        .animation-delay-200 {
          animation-delay: 0.2s;
          animation-fill-mode: backwards;
        }
        .animation-delay-300 {
          animation-delay: 0.3s;
          animation-fill-mode: backwards;
        }
        .animation-delay-400 {
          animation-delay: 0.4s;
          animation-fill-mode: backwards;
        }
      `}</style>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-green-600" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
