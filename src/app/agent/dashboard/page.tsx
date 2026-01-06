'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Calendar,
  Ticket,
  LogOut,
  Zap,
  Check,
  X as CloseIcon,
  MessageCircle,
} from 'lucide-react';

interface AgentData {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface Profile {
  id: string;
  name: string;
  costPrice: number;
  resellerFee: number;
  sellingPrice: number;
  downloadSpeed: number;
  uploadSpeed: number;
  validityValue: number;
  validityUnit: string;
}

interface Voucher {
  id: string;
  code: string;
  batchCode: string;
  status: string;
  profileName: string;
  firstLoginAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function AgentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [stats, setStats] = useState({
    currentMonth: { total: 0, count: 0 },
    allTime: { total: 0, count: 0 },
    generated: 0,
    waiting: 0,
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [generatedVouchers, setGeneratedVouchers] = useState<any[]>([]);
  const [showVouchersModal, setShowVouchersModal] = useState(false);
  
  // WhatsApp functionality
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  useEffect(() => {
    // Check if agent is logged in
    const agentDataStr = localStorage.getItem('agentData');
    if (!agentDataStr) {
      router.push('/agent');
      return;
    }

    const agentData = JSON.parse(agentDataStr);
    setAgent(agentData);
    loadDashboard(agentData.id);
  }, [router]);

  const loadDashboard = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agent/dashboard?agentId=${agentId}`);
      const data = await res.json();

      if (res.ok) {
        setStats(data.stats);
        setProfiles(data.profiles);
        setVouchers(data.vouchers || []);
        if (data.profiles.length > 0) {
          setSelectedProfile(data.profiles[0].id);
        }
      }
    } catch (error) {
      console.error('Load dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('agentData');
    router.push('/agent');
  };

  const handleSelectVoucher = (voucherId: string) => {
    setSelectedVouchers(prev => 
      prev.includes(voucherId) 
        ? prev.filter(id => id !== voucherId)
        : [...prev, voucherId]
    )
  }

  const handleSelectAll = () => {
    const waitingVouchers = vouchers.filter(v => v.status === 'WAITING').map(v => v.id)
    setSelectedVouchers(waitingVouchers.length === selectedVouchers.length ? [] : waitingVouchers)
  }

  const handleSendWhatsApp = async () => {
    if (selectedVouchers.length === 0) {
      await showError('Pilih voucher terlebih dahulu');
      return
    }
    setShowWhatsAppDialog(true)
  }

  const handleWhatsAppSubmit = async () => {
    if (!whatsappPhone) {
      await showError('Masukkan nomor WhatsApp');
      return
    }

    setSendingWhatsApp(true)
    try {
      const vouchersToSend = vouchers.filter(v => selectedVouchers.includes(v.id))
      
      // Get profile info for each voucher
      const vouchersData = vouchersToSend.map(v => {
        const profile = profiles.find(p => p.name === v.profileName)
        return {
          code: v.code,
          profileName: v.profileName,
          price: profile?.sellingPrice || 0,
          validity: profile ? `${profile.validityValue} ${profile.validityUnit.toLowerCase()}` : '-'
        }
      })

      const res = await fetch('/api/hotspot/voucher/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappPhone,
          vouchers: vouchersData
        })
      })

      const data = await res.json()

      if (data.success) {
        await showSuccess(`WhatsApp berhasil dikirim ke ${whatsappPhone}!`)
        setShowWhatsAppDialog(false)
        setWhatsappPhone('')
        setSelectedVouchers([])
      } else {
        await showError('Gagal: ' + data.error)
      }
    } catch (error) {
      console.error('Send WhatsApp error:', error)
      await showError('Gagal mengirim WhatsApp')
    } finally {
      setSendingWhatsApp(false)
    }
  }

  const handleGenerate = async () => {
    if (!agent || !selectedProfile) return;
    
    // Confirmation
    const profile = profiles.find(p => p.id === selectedProfile);
    if (!profile) return;
    
    const totalCost = profile.costPrice * quantity;
    const confirmed = await showConfirm(
      `Generate ${quantity} voucher(s) ${profile.name}?\n\nTotal Harga: ${formatCurrency(totalCost)}`,
      'Generate Voucher'
    );
    
    if (!confirmed) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/agent/generate-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          profileId: selectedProfile,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setGeneratedVouchers(data.vouchers);
        setShowVouchersModal(true);
        // Reload dashboard to update stats
        loadDashboard(agent.id);
        await showSuccess(`${data.vouchers.length} voucher berhasil digenerate!`);
      } else {
        await showError('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Generate error:', error);
      await showError('Gagal generate voucher');
    } finally {
      setGenerating(false);
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
    const unitMap: Record<string, string> = {
      MINUTES: value === 1 ? 'Minute' : 'Minutes',
      HOURS: value === 1 ? 'Hour' : 'Hours',
      DAYS: value === 1 ? 'Day' : 'Days',
      MONTHS: value === 1 ? 'Month' : 'Months',
    };
    return `${value} ${unitMap[unit] || unit}`;
  };

  const currentMonthName = new Date().toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const selectedProfileData = profiles.find(p => p.id === selectedProfile);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dashboard Agent
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Selamat datang, {agent.name}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentMonthName}
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(stats.currentMonth.total)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.currentMonth.count} vouchers
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Penjualan</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(stats.allTime.total)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.allTime.count} vouchers
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Voucher Tersedia</p>
                <p className="text-2xl font-bold mt-1">{stats.waiting}</p>
                <p className="text-xs text-gray-500 mt-1">dari {stats.generated} total</p>
              </div>
              <Ticket className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Quick Generate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Quick Generate Voucher</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Pilih Paket</label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} - {formatCurrency(profile.sellingPrice)} - {profile.downloadSpeed}/{profile.uploadSpeed} Mbps
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Jumlah</label>
              <input
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
              />
            </div>
          </div>

          {selectedProfileData && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Harga Beli</p>
                  <p className="font-semibold">
                    {formatCurrency(selectedProfileData.costPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Keuntungan/pcs</p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(selectedProfileData.resellerFee)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Speed</p>
                  <p className="font-semibold">{selectedProfileData.downloadSpeed}/{selectedProfileData.uploadSpeed} Mbps</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Total Bayar</p>
                  <p className="font-semibold text-blue-600">
                    {formatCurrency(selectedProfileData.costPrice * quantity)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !selectedProfile}
            className="mt-4 w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 mr-2" />
                Generate Voucher
              </>
            )}
          </button>
        </div>

        {/* Vouchers List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Voucher Saya</h2>
              <p className="text-sm text-gray-500">Semua voucher yang sudah di-generate</p>
            </div>
            {selectedVouchers.length > 0 && (
              <button
                onClick={handleSendWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition"
              >
                <MessageCircle className="h-4 w-4" />
                Kirim WA ({selectedVouchers.length})
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={selectedVouchers.length > 0 && selectedVouchers.length === vouchers.filter(v => v.status === 'WAITING').length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kode Voucher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paket</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Login</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dibuat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Belum ada voucher. Generate voucher pertama Anda di atas.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((voucher) => (
                    <tr key={voucher.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        {voucher.status === 'WAITING' && (
                          <input
                            type="checkbox"
                            checked={selectedVouchers.includes(voucher.id)}
                            onChange={() => handleSelectVoucher(voucher.id)}
                            className="rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold">{voucher.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{voucher.batchCode}</td>
                      <td className="px-6 py-4 text-sm">{voucher.profileName}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          voucher.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : voucher.status === 'EXPIRED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {voucher.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {voucher.firstLoginAt 
                          ? formatWIB(new Date(voucher.firstLoginAt), 'dd/MM/yyyy HH:mm')
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {voucher.expiresAt 
                          ? formatWIB(new Date(voucher.expiresAt), 'dd/MM/yyyy HH:mm')
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatWIB(new Date(voucher.createdAt), 'dd MMM yyyy HH:mm')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Generated Vouchers Modal */}
      {showVouchersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                <h2 className="text-xl font-semibold">Voucher Berhasil Dibuat!</h2>
              </div>
              <button
                onClick={() => {
                  setShowVouchersModal(false);
                  setGeneratedVouchers([]);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Salin kode voucher di bawah ini untuk pelanggan Anda
              </p>
              <div className="space-y-2">
                {generatedVouchers.map((voucher, index) => (
                  <div
                    key={voucher.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="text-sm text-gray-500">Voucher {index + 1}</p>
                      <p className="text-2xl font-mono font-bold">{voucher.code}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(voucher.code);
                        alert('Kode disalin!');
                      }}
                      className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Dialog */}
      {showWhatsAppDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold">Kirim Voucher via WhatsApp</h2>
              <p className="text-sm text-gray-500 mt-1">
                Kirim {selectedVouchers.length} voucher ke customer
              </p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium mb-2">Nomor WhatsApp</label>
              <input
                type="tel"
                placeholder="628123456789"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">
                Masukkan nomor dengan kode negara (contoh: 628123456789)
              </p>
            </div>

            <div className="px-6 py-4 border-t dark:border-gray-700 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowWhatsAppDialog(false)
                  setWhatsappPhone('')
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Batal
              </button>
              <button
                onClick={handleWhatsAppSubmit}
                disabled={sendingWhatsApp || !whatsappPhone}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sendingWhatsApp ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Mengirim...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" />
                    Kirim WhatsApp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
