'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Clock, RefreshCw, ExternalLink, Loader2, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  paymentLink: string | null;
}

function PaymentPendingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (token) {
      fetchInvoiceStatus();
    } else {
      setError('Token pembayaran tidak ditemukan');
      setLoading(false);
    }
  }, [token]);

  // Auto refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh || !token) return;

    const interval = setInterval(() => {
      fetchInvoiceStatus(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, token]);

  const fetchInvoiceStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    
    try {
      const res = await fetch(`/api/invoices/check?token=${token}`);
      const data = await res.json();

      if (res.ok && data.invoice) {
        setInvoice(data.invoice);
        
        // Redirect if payment is completed
        if (data.invoice.status === 'PAID') {
          router.push(`/payment/success?token=${token}`);
        }
      } else {
        setError(data.error || 'Invoice tidak ditemukan');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      if (!silent) {
        setError('Gagal mengecek status pembayaran');
      }
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  const handleCheckStatus = () => {
    setChecking(true);
    fetchInvoiceStatus();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Pending Animation */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-block relative">
            <div className="absolute inset-0 bg-blue-400 rounded-full opacity-20 animate-pulse"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
              <Clock className="w-14 h-14 text-white animate-bounce" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mt-6 mb-2 animate-slide-up">
            Menunggu Pembayaran
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 text-lg animate-slide-up animation-delay-100">
            Pembayaran sedang diproses
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden mb-6 animate-slide-up animation-delay-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Invoice</span>
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold">
                PENDING
              </span>
            </div>
            <h2 className="text-2xl font-bold">#{invoice.invoiceNumber}</h2>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Amount */}
            <div className="text-center py-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Pembayaran</p>
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                {formatCurrency(invoice.amount)}
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-semibold">Langkah Selanjutnya:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Selesaikan pembayaran melalui halaman yang terbuka</li>
                    <li>Jangan tutup halaman ini</li>
                    <li>Status akan otomatis terupdate setelah pembayaran berhasil</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Auto Refresh Indicator */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Auto-refresh setiap 5 detik</span>
            </div>

            {/* Payment Link */}
            {invoice.paymentLink && (
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Kembali ke halaman pembayaran:
                </p>
                <a
                  href={invoice.paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg shadow-lg transition-all transform hover:scale-105"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span className="font-semibold">Buka Halaman Pembayaran</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-4 animate-slide-up animation-delay-300">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
            <span className="font-semibold">
              {checking ? 'Mengecek...' : 'Cek Status Sekarang'}
            </span>
          </button>

          <button
            onClick={() => router.push(`/pay/${token}`)}
            className="px-6 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl transition-all transform hover:scale-105"
          >
            <span className="font-semibold">Kembali ke Invoice</span>
          </button>
        </div>

        {/* Help Text */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400 animate-fade-in animation-delay-400">
          <p>Pembayaran memerlukan waktu beberapa saat untuk diverifikasi</p>
          <p className="mt-1">Halaman ini akan otomatis redirect setelah pembayaran berhasil</p>
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
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
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

export default function PaymentPendingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    }>
      <PaymentPendingContent />
    </Suspense>
  );
}
