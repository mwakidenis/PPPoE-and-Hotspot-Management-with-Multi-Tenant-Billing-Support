'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, XCircle, Clock, Eye, EyeOff, MapPin, Map } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';

interface User {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  profile: { id: string; name: string };
  router?: { id: string; name: string } | null;
  ipAddress: string | null;
  expiredAt: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Session {
  id: string;
  sessionId: string;
  startTime: Date;
  stopTime: Date | null;
  durationFormatted: string;
  download: string;
  upload: string;
  total: string;
  nasIp: string;
  terminateCause: string;
  macAddress?: string;
  isOnline: boolean;
}

interface AuthLog {
  id: number;
  username: string;
  reply: string;
  authdate: Date;
  success: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
}

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (data: any) => Promise<void>;
  profiles: any[];
  routers: any[];
  currentLatLng?: { lat: string; lng: string };
  onLatLngChange?: (lat: string, lng: string) => void;
}

export default function UserDetailModal({
  isOpen,
  onClose,
  user,
  onSave,
  profiles,
  routers,
  currentLatLng,
  onLatLngChange,
}: UserDetailModalProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [authLogs, setAuthLogs] = useState<AuthLog[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    profileId: '',
    routerId: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    ipAddress: '',
    expiredAt: '',
    latitude: '',
    longitude: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: '',
        profileId: user.profile.id,
        routerId: user.router?.id || '',
        name: user.name,
        phone: user.phone,
        email: user.email || '',
        address: user.address || '',
        ipAddress: user.ipAddress || '',
        expiredAt: user.expiredAt ? user.expiredAt.split('T')[0] : '',
        latitude: user.latitude?.toString() || '',
        longitude: user.longitude?.toString() || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab !== 'info') {
      loadTabData(activeTab);
    }
  }, [user, activeTab]);

  // Sync lat/lng from parent (for map picker)
  useEffect(() => {
    if (currentLatLng) {
      setFormData(prev => ({
        ...prev,
        latitude: currentLatLng.lat,
        longitude: currentLatLng.lng,
      }));
    }
  }, [currentLatLng]);

  const loadTabData = async (tab: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pppoe/users/${user.id}/activity?type=${tab === 'sessions' ? 'sessions' : tab === 'auth' ? 'auth' : 'invoices'}`);
      const data = await res.json();
      
      if (data.success) {
        if (tab === 'sessions') {
          setSessions(data.data);
        } else if (tab === 'auth') {
          setAuthLogs(data.data);
        } else if (tab === 'invoices') {
          setInvoices(data.data);
        }
      }
    } catch (error) {
      console.error('Load tab data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...formData, id: user?.id });
    onClose();
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              User Details
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {user.username}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex px-6">
            {[
              { id: 'info', label: 'User Info' },
              { id: 'sessions', label: 'Sessions' },
              { id: 'auth', label: 'Auth Logs' },
              { id: 'invoices', label: 'Invoices' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    required
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg pr-10"
                      placeholder="Leave empty to keep current"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Profile</label>
                  <select
                    value={formData.profileId}
                    onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    required
                  >
                    <option value="">Select Profile</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Router</label>
                  <select
                    value={formData.routerId}
                    onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="">Auto-assign</option>
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">IP Address</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    placeholder="Auto-assign if empty"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    rows={2}
                  />
                </div>
                
                {/* GPS Location */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">GPS Location (Optional)</label>
                    <div className="flex gap-2">
                      {onLatLngChange && (
                        <button
                          type="button"
                          onClick={() => {
                            // Notify parent to open map picker with current values
                            onLatLngChange(formData.latitude, formData.longitude);
                          }}
                          className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                        >
                          <Map className="h-3 w-3 mr-1" />
                          Pilih di Peta
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                setFormData({
                                  ...formData,
                                  latitude: position.coords.latitude.toFixed(6),
                                  longitude: position.coords.longitude.toFixed(6),
                                });
                              },
                              (error) => {
                                alert('Failed to get location: ' + error.message);
                              }
                            );
                          } else {
                            alert('Geolocation is not supported by this browser.');
                          }
                        }}
                        className="inline-flex items-center px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition"
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        GPS Auto
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      placeholder="Latitude"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="Longitude"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Pilih di peta atau gunakan GPS otomatis
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Expired At</label>
                  <input
                    type="date"
                    value={formData.expiredAt}
                    onChange={(e) => setFormData({ ...formData, expiredAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'sessions' && (
            <div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No session history found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {session.isOnline ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                Online
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                Offline
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {session.durationFormatted}
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1">
                            {formatWIB(session.startTime, 'dd MMM yyyy HH:mm')}
                            {session.stopTime && (
                              <> - {formatWIB(session.stopTime, 'HH:mm')}</>
                            )}
                          </p>
                          {session.macAddress && session.macAddress !== '-' && (
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                              MAC: {session.macAddress}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <div>↓ {session.download}</div>
                          <div>↑ {session.upload}</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            Total: {session.total}
                          </div>
                        </div>
                      </div>
                      {session.terminateCause && !session.isOnline && (
                        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                          Terminate: {session.terminateCause}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'auth' && (
            <div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : authLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <XCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No authentication logs found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {authLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {log.success ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{log.reply}</p>
                          <p className="text-xs text-gray-500">
                            {formatWIB(log.authdate, 'dd MMM yyyy HH:mm:ss')}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          log.success
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {log.success ? 'Success' : 'Rejected'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No invoices found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Due: {formatWIB(invoice.dueDate, 'dd MMM yyyy')}
                          </p>
                          {invoice.paidAt && (
                            <p className="text-xs text-green-600 mt-1">
                              Paid: {formatWIB(invoice.paidAt, 'dd MMM yyyy')}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              minimumFractionDigits: 0,
                            }).format(invoice.amount)}
                          </p>
                          <span
                            className={`inline-block text-xs px-2 py-1 rounded mt-1 ${
                              invoice.status === 'PAID'
                                ? 'bg-green-50 text-green-700'
                                : invoice.status === 'PENDING'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
