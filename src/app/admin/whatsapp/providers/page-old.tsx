'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Send, Check, X, QrCode, RefreshCw, Power, PowerOff } from 'lucide-react';

interface WhatsAppProvider {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  apiUrl: string;
  senderNumber?: string | null;
  isActive: boolean;
  priority: number;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProviderStatus {
  status: string;
  connected: boolean;
  phone?: string | null;
  name?: string | null;
}

export default function WhatsAppProvidersPage() {
  const [providers, setProviders] = useState<WhatsAppProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrProvider, setQrProvider] = useState<WhatsAppProvider | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatus>>({});
  const [restartingProvider, setRestartingProvider] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'fonnte',
    apiKey: '',
    apiUrl: '',
    senderNumber: '',
    description: '',
    isActive: true,
    priority: 0,
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/whatsapp/providers');
      const data = await res.json();
      setProviders(data.sort((a: WhatsAppProvider, b: WhatsAppProvider) => a.priority - b.priority));
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId
        ? `/api/whatsapp/providers/${editingId}`
        : '/api/whatsapp/providers';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save provider');

      await fetchProviders();
      resetForm();
    } catch (error) {
      console.error('Failed to save provider:', error);
      alert('Gagal menyimpan provider');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus provider ini?')) return;
    
    try {
      const res = await fetch(`/api/whatsapp/providers/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete provider');

      await fetchProviders();
    } catch (error) {
      console.error('Failed to delete provider:', error);
      alert('Gagal menghapus provider');
    }
  };

  const handleEdit = (provider: WhatsAppProvider) => {
    setFormData({
      name: provider.name,
      type: provider.type,
      apiKey: provider.apiKey,
      apiUrl: provider.apiUrl,
      isActive: provider.isActive,
      priority: provider.priority,
    });
    setEditingId(provider.id);
    setShowForm(true);
  };

  const handleTest = async (id: string) => {
    if (!testPhone.trim()) {
      alert('Masukkan nomor WhatsApp untuk test');
      return;
    }

    try {
      const res = await fetch(`/api/whatsapp/providers/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      });

      const data = await res.json();

      if (data.success) {
        alert('✅ Test berhasil! Pesan terkirim.');
      } else {
        alert(`❌ Test gagal: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to test provider:', error);
      alert('❌ Test gagal');
    } finally {
      setTestingId(null);
      setTestPhone('');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'fonnte',
      apiKey: '',
      apiUrl: '',
      isActive: true,
      priority: 0,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getProviderTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      fonnte: 'Fonnte',
      waha: 'WAHA (WA HTTP API)',
      mpwa: 'MPWA',
      wablas: 'Wablas',
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Memuat...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Providers</h1>
          <p className="text-sm text-gray-600 mt-1">
            Kelola provider WhatsApp dengan sistem failover otomatis
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus size={20} />
          Tambah Provider
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Edit Provider' : 'Tambah Provider'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Provider</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Contoh: Fonnte Primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tipe Provider</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                >
                  <option value="fonnte">Fonnte</option>
                  <option value="waha">WAHA (WA HTTP API)</option>
                  <option value="mpwa">MPWA</option>
                  <option value="wablas">Wablas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">API Key / Token</label>
                <input
                  type="text"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Token dari provider"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">API URL</label>
                <input
                  type="url"
                  value={formData.apiUrl}
                  onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="https://api.fonnte.com/send"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Priority (0 = tertinggi)</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                  min="0"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provider dengan priority lebih rendah akan dicoba lebih dulu
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  Provider Aktif
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  {editingId ? 'Update' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {providers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Belum ada provider. Tambahkan provider pertama Anda.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nama</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tipe</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">API URL</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {providers.map((provider) => (
                <tr key={provider.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                      {provider.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{provider.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {getProviderTypeLabel(provider.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {provider.apiUrl}
                  </td>
                  <td className="px-4 py-3">
                    {provider.isActive ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                        <Check size={16} />
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                        <X size={16} />
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {testingId === provider.id ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            placeholder="628xxx"
                            className="border rounded px-2 py-1 text-sm w-32"
                            autoFocus
                          />
                          <button
                            onClick={() => handleTest(provider.id)}
                            className="text-green-600 hover:text-green-700"
                            title="Kirim"
                          >
                            <Send size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setTestingId(null);
                              setTestPhone('');
                            }}
                            className="text-gray-600 hover:text-gray-700"
                            title="Batal"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setTestingId(provider.id)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Test Provider"
                          >
                            <Send size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(provider)}
                            className="text-yellow-600 hover:text-yellow-700"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(provider.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Cara Kerja Failover:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Provider dengan priority <strong>lebih rendah</strong> akan dicoba terlebih dahulu</li>
          <li>Jika gagal, sistem otomatis mencoba provider berikutnya</li>
          <li>Semua percobaan dan hasil dicatat di history</li>
          <li>Gunakan tombol <Send size={14} className="inline" /> untuk test provider</li>
        </ul>
      </div>
    </div>
  );
}
