'use client';
import { showSuccess, showError, showWarning } from '@/lib/sweetalert';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi, ShoppingCart, Loader2, CheckCircle, Zap, Clock, Phone, User, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Profile {
  id: string;
  name: string;
  sellingPrice: number;
  downloadSpeed: number;
  uploadSpeed: number;
  validityValue: number;
  validityUnit: string;
  eVoucherAccess: boolean;
}

export default function EVoucherPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/evoucher/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
      }
    } catch (error) {
      console.error('Load profiles error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProfile) {
      await showWarning('Silakan pilih paket terlebih dahulu');
      return;
    }

    setPurchasing(true);

    try {
      const res = await fetch('/api/evoucher/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfile.id,
          customerName: formData.name,
          customerPhone: formData.phone,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Redirect to payment page
        router.push(data.order.paymentLink);
      } else {
        await showError(data.error || 'Gagal membuat pesanan');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      await showError('Gagal membuat pesanan. Silakan coba lagi.');
    } finally {
      setPurchasing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatValidity = (value: number, unit: string) => {
    const unitMap: { [key: string]: string } = {
      MINUTES: 'Menit',
      HOURS: 'Jam',
      DAYS: 'Hari',
      MONTHS: 'Bulan',
    };
    return `${value} ${unitMap[unit] || unit}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading packages...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <Wifi className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Beli Voucher WiFi
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Pilih paket WiFi sesuai kebutuhan Anda
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voucher Packages */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Paket WiFi Tersedia
            </h2>
            
            {profiles.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Wifi className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Belum ada paket tersedia saat ini
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {profiles.map((profile) => (
                  <Card
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile)}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedProfile?.id === profile.id
                        ? 'ring-2 ring-blue-600 shadow-md'
                        : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <Badge className="mb-1.5 text-xs" variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatValidity(profile.validityValue, profile.validityUnit)}
                          </Badge>
                          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-0.5 line-clamp-1">
                            {profile.name}
                          </h3>
                          <div className="flex items-center text-gray-600 dark:text-gray-400 text-xs">
                            <Zap className="h-3 w-3 mr-1 text-blue-600" />
                            <span>{profile.downloadSpeed}/{profile.uploadSpeed} Mbps</span>
                          </div>
                        </div>
                        {selectedProfile?.id === profile.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        )}
                      </div>

                      <div className="pt-3 border-t flex justify-between items-center">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Harga</p>
                          <p className="text-lg font-bold text-blue-600">
                            {formatCurrency(profile.sellingPrice)}
                          </p>
                        </div>
                        <Button size="sm" variant={selectedProfile?.id === profile.id ? "default" : "outline"} className="text-xs">
                          {selectedProfile?.id === profile.id ? 'Dipilih' : 'Pilih'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Order Form */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Ringkasan Pesanan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedProfile ? (
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Paket Dipilih
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {selectedProfile.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {formatValidity(selectedProfile.validityValue, selectedProfile.validityUnit)} • {selectedProfile.downloadSpeed}/{selectedProfile.uploadSpeed} Mbps
                    </p>
                    <div className="pt-3 border-t flex justify-between items-baseline">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Bayar</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(selectedProfile.sellingPrice)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-center border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <Wifi className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Pilih paket terlebih dahulu
                    </p>
                  </div>
                )}

                <form onSubmit={handlePurchase} className="space-y-4">
                  <div>
                    <Label htmlFor="name">
                      <User className="h-4 w-4 inline mr-1" />
                      Nama Lengkap *
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Masukkan nama Anda"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">
                      <Phone className="h-4 w-4 inline mr-1" />
                      Nomor WhatsApp *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      placeholder="08123456789"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Kode voucher akan dikirim ke nomor ini
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={!selectedProfile || purchasing}
                    className="w-full"
                    size="lg"
                  >
                    {purchasing ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Beli Sekarang
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    Dengan melanjutkan, Anda menyetujui syarat & ketentuan kami
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 py-6 border-t border-gray-200 dark:border-gray-800">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          By AIBILL RADIUS
        </p>
      </div>
    </div>
  );
}
