'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { XCircle, RefreshCw, Home, Loader2, AlertTriangle } from 'lucide-react';

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const reason = searchParams.get('reason');
  
  const [loading, setLoading] = useState(true);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [companyPhone, setCompanyPhone] = useState('6281234567890');

  useEffect(() => {
    if (token) {
      fetchInvoiceInfo();
    } else {
      setLoading(false);
    }
    
    // Fetch company phone
    fetch('/api/company')
      .then(res => res.json())
      .then(data => {
        if (data.phone) {
          let phone = data.phone.replace(/^0/, '62');
          if (!phone.startsWith('62')) phone = '62' + phone;
          setCompanyPhone(phone);
        }
      })
      .catch(err => console.error('Fetch company phone error:', err));
  }, [token]);

  const fetchInvoiceInfo = async () => {
    try {
      const res = await fetch(`/api/invoices/check?token=${token}`);
      const data = await res.json();

      if (res.ok && data.invoice) {
        setInvoiceNumber(data.invoice.invoiceNumber);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat informasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Failed Animation */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-block relative">
            <div className="absolute inset-0 bg-red-400 rounded-full opacity-20 animate-pulse"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-red-400 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
              <XCircle className="w-14 h-14 text-white animate-scale-in" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent mt-6 mb-2 animate-slide-up">
            Pembayaran Gagal
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 text-lg animate-slide-up animation-delay-100">
            Transaksi tidak dapat diselesaikan
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden mb-6 animate-slide-up animation-delay-200">
          <div className="p-8 space-y-6">
            {/* Warning Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
            </div>

            {invoiceNumber && (
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Invoice</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  #{invoiceNumber}
                </p>
              </div>
            )}

            {/* Reason */}
            {reason && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-sm font-medium text-red-800 dark:text-red-300 text-center">
                  {decodeURIComponent(reason)}
                </p>
              </div>
            )}

            {/* Info */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Kemungkinan Penyebab:</strong>
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
                <li>Saldo atau limit kartu tidak mencukupi</li>
                <li>Pembayaran dibatalkan oleh pengguna</li>
                <li>Transaksi ditolak oleh bank</li>
                <li>Waktu pembayaran telah habis</li>
                <li>Koneksi internet terputus</li>
              </ul>
            </div>

            {/* Help Text */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p>Jangan khawatir, tidak ada biaya yang dikenakan.</p>
              <p className="mt-1">Silakan coba lagi atau hubungi kami jika masalah berlanjut.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up animation-delay-300">
          <button
            onClick={() => router.push('/')}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 transition-all transform hover:scale-105"
          >
            <Home className="w-5 h-5" />
            <span className="font-semibold">Kembali</span>
          </button>
          
          {token && (
            <button
              onClick={() => router.push(`/pay/${token}`)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-xl shadow-lg shadow-red-500/30 transition-all transform hover:scale-105"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="font-semibold">Coba Lagi</span>
            </button>
          )}
        </div>

        {/* Support Info */}
        <div className="text-center mt-8 animate-fade-in animation-delay-400">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Butuh bantuan?
          </p>
          <a 
            href={`https://wa.me/${companyPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium text-sm transition-colors"
          >
            Hubungi Customer Service via WhatsApp
          </a>
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

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-red-600" />
      </div>
    }>
      <PaymentFailedContent />
    </Suspense>
  );
}
