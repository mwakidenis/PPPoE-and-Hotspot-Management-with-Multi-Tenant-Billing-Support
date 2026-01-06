'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Power, PowerOff, QrCode, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

interface Provider {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey: string | null;
  senderNumber?: string | null;
  priority: number;
  isActive: boolean;
  description: string | null;
}

interface ProviderStatus {
  status: string;
  connected: boolean;
  phone?: string | null;
  name?: string | null;
}

export default function WhatsAppProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrProvider, setQrProvider] = useState<Provider | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatus>>({});
  const [restartingProvider, setRestartingProvider] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'mpwa',
    apiUrl: '',
    apiKey: '',
    senderNumber: '',
    priority: 0,
    description: ''
  });

  useEffect(() => {
    fetchProviders();
    const interval = setInterval(() => {
      fetchAllStatuses();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (providers.length > 0) {
      fetchAllStatuses();
    }
  }, [providers]);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/whatsapp/providers');
      const data = await res.json();
      setProviders(data.sort((a: Provider, b: Provider) => a.priority - b.priority));
    } catch (error) {
      console.error('Error fetching providers:', error);
      Swal.fire('Error!', 'Failed to fetch providers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStatuses = async () => {
    if (providers.length === 0) return;
    
    const newStatuses: Record<string, ProviderStatus> = {};
    
    await Promise.all(
      providers.map(async (provider) => {
        if (provider.type === 'mpwa' || provider.type === 'waha' || provider.type === 'gowa') {
          try {
            const res = await fetch(`/api/whatsapp/providers/${provider.id}/status`);
            if (res.ok) {
              newStatuses[provider.id] = await res.json();
            }
          } catch (error) {
            console.error(`Error fetching status for ${provider.name}:`, error);
            // Keep existing status if fetch fails
          }
        }
      })
    );
    
    // Merge with existing statuses instead of replacing
    setProviderStatuses(prev => ({ ...prev, ...newStatuses }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.name || !formData.type || !formData.apiUrl) {
      Swal.fire('Error!', 'Name, Type, and Base URL are required', 'error');
      return;
    }
    
    if ((formData.type === 'mpwa' || formData.type === 'gowa') && !formData.apiKey) {
      Swal.fire('Error!', `API Key is required for ${formData.type.toUpperCase()}`, 'error');
      return;
    }
    
    if (formData.type === 'mpwa' && !formData.senderNumber) {
      Swal.fire('Error!', 'Sender Number is required for MPWA', 'error');
      return;
    }
    
    try {
      const url = editingProvider 
        ? `/api/whatsapp/providers/${editingProvider.id}`
        : '/api/whatsapp/providers';
      
      const res = await fetch(url, {
        method: editingProvider ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        Swal.fire('Berhasil!', editingProvider ? 'Provider updated' : 'Provider created', 'success');
        fetchProviders();
        resetForm();
      } else {
        const data = await res.json();
        Swal.fire('Error!', data.error || 'Failed to save provider', 'error');
      }
    } catch (error) {
      console.error('Error saving provider:', error);
      Swal.fire('Error!', 'Failed to save provider', 'error');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/whatsapp/providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      
      if (res.ok) {
        Swal.fire('Berhasil!', !currentStatus ? 'Provider activated' : 'Provider deactivated', 'success');
        fetchProviders();
      } else {
        Swal.fire('Error!', 'Failed to toggle provider', 'error');
      }
    } catch (error) {
      console.error('Error toggling provider:', error);
      Swal.fire('Error!', 'Failed to toggle provider', 'error');
    }
  };

  const deleteProvider = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Provider?',
      text: 'Device ini akan dihapus permanen!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;
    
    try {
      const res = await fetch(`/api/whatsapp/providers/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        Swal.fire('Terhapus!', 'Provider deleted successfully', 'success');
        fetchProviders();
      } else {
        Swal.fire('Error!', 'Failed to delete provider', 'error');
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
      Swal.fire('Error!', 'Failed to delete provider', 'error');
    }
  };

  const editProvider = (provider: Provider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      apiUrl: provider.apiUrl,
      apiKey: provider.apiKey || '',
      senderNumber: provider.senderNumber || '',
      priority: provider.priority,
      description: provider.description || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'mpwa',
      apiUrl: '',
      apiKey: '',
      senderNumber: '',
      priority: 0,
      description: ''
    });
    setEditingProvider(null);
    setShowForm(false);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'mpwa': return 'bg-blue-100 text-blue-800';
      case 'waha': return 'bg-purple-100 text-purple-800';
      case 'fonnte': return 'bg-green-100 text-green-800';
      case 'wablas': return 'bg-orange-100 text-orange-800';
      case 'gowa': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const restartSession = async (provider: Provider) => {
    const result = await Swal.fire({
      title: `Restart session ${provider.name}?`,
      html: `
        <p class="text-sm mb-2"><strong>PENTING:</strong> Hapus device ini dari WhatsApp > Linked Devices terlebih dahulu!</p>
        <p class="text-sm">Ini akan clear session dan siap untuk scan QR baru.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Restart!',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    setRestartingProvider(provider.id);

    try {
      const res = await fetch(`/api/whatsapp/providers/${provider.id}/restart`, {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to restart session');
      }

      Swal.fire('Berhasil!', 'Session restarted! Silakan scan QR code.', 'success');
      fetchAllStatuses();
      
      setTimeout(() => {
        showQrCode(provider);
      }, 1000);
    } catch (error: any) {
      console.error('Restart error:', error);
      Swal.fire('Error!', error.message || 'Failed to restart session', 'error');
    } finally {
      setRestartingProvider(null);
    }
  };

  const showQrCode = async (provider: Provider) => {
    setQrProvider(provider);
    setShowQrModal(true);
    setQrLoading(true);
    setQrImage(null);
    
    try {
      const url = `/api/whatsapp/providers/${provider.id}/qr`;
      const response = await fetch(url);
      
      if (response.ok) {
        if (provider.type === 'mpwa') {
          // MPWA returns JSON with base64 QR
          const data = await response.json();
          if (data.status === 'qrcode' && data.qrcode) {
            setQrImage(data.qrcode);
          } else {
            Swal.fire('Info', `Device status: ${data.message || data.status}`, 'info');
          }
        } else {
          // WAHA and GOWA return image blob
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setQrImage(imageUrl);
        }
      } else if (response.status === 422) {
        // Already connected
        const errorData = await response.json();
        Swal.fire('Info', errorData.error || 'Device already connected', 'info');
        setShowQrModal(false);
        // Refresh status
        fetchAllStatuses();
      } else {
        const errorData = await response.json();
        Swal.fire('Error!', errorData.error || 'Failed to fetch QR code', 'error');
        setShowQrModal(false);
      }
    } catch (error) {
      console.error('Error fetching QR:', error);
      Swal.fire('Error!', 'Error fetching QR code', 'error');
      setShowQrModal(false);
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Providers</h1>
          <p className="text-gray-600">Manage WhatsApp devices with failover support</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Provider
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{editingProvider ? 'Edit' : 'Add'} Provider</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Provider Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="MPWA Device 1"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="mpwa">MPWA</option>
                    <option value="waha">WAHA</option>
                    <option value="gowa">GOWA</option>
                    <option value="fonnte">Fonnte</option>
                    <option value="wablas">Wablas</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Base URL</label>
                  <input
                    type="text"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({...formData, apiUrl: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="http://10.100.0.245:2451"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    API Key {formData.type === 'mpwa' || formData.type === 'gowa' ? '(required)' : '(optional)'}
                  </label>
                  <input
                    type="text"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder={formData.type === 'gowa' ? 'username:password' : 'API Key or Token'}
                    required={formData.type === 'mpwa' || formData.type === 'gowa'}
                  />
                  {formData.type === 'gowa' && (
                    <p className="text-xs text-gray-500 mt-1">Format: username:password (e.g., admin:yourpassword)</p>
                  )}
                </div>
                
                {formData.type === 'mpwa' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Sender Number (required for MPWA)</label>
                    <input
                      type="text"
                      value={formData.senderNumber}
                      onChange={(e) => setFormData({...formData, senderNumber: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="0816104997 atau 62816104997"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">The WhatsApp number connected to MPWA</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium mb-1">Priority (0=Primary, 1=Backup, etc)</label>
                  <input
                    type="number"
                    value={formData.priority || 0}
                    onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-md"
                    min="0"
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={2}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                  Save
                </button>
                <button type="button" onClick={resetForm} className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <div key={provider.id} className={`bg-white rounded-lg shadow p-6 space-y-4 ${provider.isActive ? '' : 'opacity-50'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{provider.name}</h3>
                  <div className="flex gap-2 items-center mt-1 flex-wrap">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTypeColor(provider.type)}`}>
                      {provider.type.toUpperCase()}
                    </span>
                    {providerStatuses[provider.id] && (
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        providerStatuses[provider.id].connected 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {providerStatuses[provider.id].connected ? '● Connected' : '○ Disconnected'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(provider.id, provider.isActive)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  {provider.isActive ? <Power className="h-5 w-5 text-green-600" /> : <PowerOff className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-gray-600">Base URL</div>
                  <div className="font-mono text-xs break-all">{provider.apiUrl}</div>
                </div>
                {provider.senderNumber && (
                  <div>
                    <div className="text-gray-600">Sender Number</div>
                    <div className="font-mono text-xs">{provider.senderNumber}</div>
                  </div>
                )}
                {providerStatuses[provider.id]?.phone && (
                  <div>
                    <div className="text-gray-600">Connected Number</div>
                    <div className="font-mono text-xs text-green-600">{providerStatuses[provider.id].phone}</div>
                  </div>
                )}
                <div>
                  <div className="text-gray-600">Priority</div>
                  <div className="font-bold">{provider.priority}</div>
                </div>
                {provider.description && (
                  <div>
                    <div className="text-gray-600">Description</div>
                    <div className="text-xs">{provider.description}</div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  {(provider.type === 'waha' || provider.type === 'mpwa' || provider.type === 'gowa') && (
                    <button
                      onClick={() => showQrCode(provider)}
                      className="flex-1 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 flex items-center justify-center gap-1 text-sm"
                    >
                      <QrCode className="h-4 w-4" />
                      QR Code
                    </button>
                  )}
                  <button
                    onClick={() => editProvider(provider)}
                    className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded hover:bg-gray-300 flex items-center justify-center gap-1 text-sm"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProvider(provider.id)}
                    className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {(provider.type === 'waha' || provider.type === 'gowa') && (
                  <button
                    onClick={() => restartSession(provider)}
                    disabled={restartingProvider === provider.id}
                    className="w-full bg-yellow-500 text-white px-3 py-2 rounded hover:bg-yellow-600 flex items-center justify-center gap-1 text-sm disabled:opacity-50"
                  >
                    {restartingProvider === provider.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Restarting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Restart Session
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && providers.length === 0 && !showForm && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 mb-4">No providers configured yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            Add First Provider
          </button>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowQrModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">QR Code - {qrProvider?.name}</h2>
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              {qrLoading ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  <p className="text-sm text-gray-600">Loading QR Code...</p>
                </div>
              ) : qrImage ? (
                <>
                  <img src={qrImage} alt="QR Code" className="w-64 h-64 border rounded" />
                  <p className="text-sm text-gray-600 text-center">
                    Scan this QR code with WhatsApp to connect
                  </p>
                  <button
                    onClick={() => showQrCode(qrProvider!)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm"
                  >
                    Refresh QR
                  </button>
                </>
              ) : (
                <p className="text-sm text-red-600">Failed to load QR code</p>
              )}
            </div>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full mt-4 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
