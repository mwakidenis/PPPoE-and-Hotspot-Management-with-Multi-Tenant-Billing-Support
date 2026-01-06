'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle, Wifi, CreditCard } from 'lucide-react';
import { showError } from '@/lib/sweetalert';
import { formatCurrency } from '@/lib/utils';

interface VoucherOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: string;
  quantity: number;
  profile: {
    name: string;
    speed: string;
    validityValue: number;
    validityUnit: string;
  };
  vouchers: Array<{
    code: string;
    status: string;
  }>;
}

export default function EVoucherPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<VoucherOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState<any[]>([]);

  useEffect(() => {
    loadOrder();
  }, [token]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/evoucher/order/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load order');
        return;
      }

      setOrder(data.order);
      setPaymentGateways(data.paymentGateways || []);
    } catch (err) {
      setError('Failed to load order');
      console.error('Load order error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (gateway: string) => {
    if (!order) return;
    
    setProcessing(true);
    
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: order.orderNumber,
          orderId: order.id,
          amount: order.totalAmount,
          gateway,
          type: 'voucher'
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        await showError(data.error || 'Gagal membuat pembayaran');
        return;
      }
      
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        await showError('Payment URL tidak tersedia');
      }
    } catch (error) {
      console.error('Payment error:', error);
      await showError('Gagal memproses pembayaran');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Order Tidak Ditemukan
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {error || 'Link pembayaran tidak valid atau sudah kadaluarsa.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If already paid, show vouchers
  if (order.status === 'PAID' && order.vouchers.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <Card className="shadow-2xl">
            <CardContent className="pt-6">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Pembayaran Berhasil!
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Voucher WiFi Anda sudah siap digunakan
                </p>
              </div>

              {/* Voucher Codes */}
              <div className="space-y-3 mb-6">
                {order.vouchers.map((voucher, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Kode Voucher #{idx + 1}
                    </p>
                    <p className="text-3xl font-bold font-mono text-blue-600 dark:text-blue-400 tracking-wider">
                      {voucher.code}
                    </p>
                  </div>
                ))}
              </div>

              {/* Instructions */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Cara Menggunakan:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Hubungkan ke WiFi</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Buka browser dan masukkan kode voucher</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Klik login dan nikmati internet cepat!</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => router.push('/evoucher')}
                className="w-full"
                size="lg"
              >
                Beli Voucher Lagi
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show payment options
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
          Pembayaran Voucher WiFi
        </h1>

        {/* Order Summary */}
        <Card className="mb-6 shadow-lg">
          <CardContent className="pt-6">
            <h2 className="font-semibold text-lg mb-4">Detail Pesanan</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Nomor Pesanan</span>
                <span className="font-mono font-bold">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Paket</span>
                <span className="font-semibold">{order.profile.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Jumlah Voucher</span>
                <span className="font-semibold">{order.quantity}x</span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-900 dark:text-white font-semibold">Total Bayar</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(order.totalAmount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <h2 className="font-semibold text-lg mb-4">Pilih Metode Pembayaran</h2>
            {paymentGateways.length === 0 ? (
              <div className="text-center py-8">
                <Wifi className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  Metode pembayaran tidak tersedia saat ini
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentGateways.map((gateway) => (
                  <Button
                    key={gateway.id}
                    onClick={() => handlePayment(gateway.provider)}
                    disabled={processing}
                    className="w-full h-auto py-4 justify-between"
                    variant="outline"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5" />
                      <span className="font-semibold">{gateway.name}</span>
                    </div>
                    {processing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-sm">Bayar Sekarang →</span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
