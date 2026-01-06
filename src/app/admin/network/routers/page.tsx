'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';

import { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  Loader2,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Activity,
  Shield,
  FileCode,
  Copy,
  Check,
} from 'lucide-react';

interface Router {
  id: string;
  name: string;
  ipAddress: string;
  username: string;
  password: string;
  port: number;
  apiPort: number;
  isActive: boolean;
  createdAt: string;
}

interface VpnClient {
  id: string;
  name: string;
  vpnIp: string;
  username: string;
  vpnType: string;
  isRadiusServer?: boolean;
}

interface RouterStatus {
  online: boolean;
  identity?: string;
  uptime?: string;
}

export default function RoutersPage() {
  const [loading, setLoading] = useState(true);
  const [routers, setRouters] = useState<Router[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, RouterStatus>>({});
  const [vpnClients, setVpnClients] = useState<VpnClient[]>([]);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRouter, setEditingRouter] = useState<Router | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteRouterId, setDeleteRouterId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [settingUpIsolir, setSettingUpIsolir] = useState<string | null>(null);
  const [showRadiusScriptModal, setShowRadiusScriptModal] = useState(false);
  const [radiusScriptRouter, setRadiusScriptRouter] = useState<Router | null>(null);
  const [radiusServerIp, setRadiusServerIp] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    username: '',
    password: '',
    port: 8728,
    apiPort: 8729,
    secret: 'secret123',
    useVpn: false,
    vpnClientId: '',
  });

  useEffect(() => {
    loadRoutersAndStatus();
    loadVpnClients();

    // Auto-refresh status every 30 seconds
    const interval = setInterval(() => {
      checkRoutersStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadRoutersAndStatus = async () => {
    try {
      const response = await fetch('/api/network/routers');
      const data = await response.json();
      const loadedRouters = data.routers || [];
      setRouters(loadedRouters);
      setLoading(false);

      // Immediately check status
      if (loadedRouters.length > 0) {
        const routerIds = loadedRouters.map((r: Router) => r.id);
        const statusResponse = await fetch('/api/network/routers/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routerIds }),
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setStatusMap(statusData.statusMap || {});
        }
      }
    } catch (error) {
      console.error('Load routers error:', error);
      setLoading(false);
    }
  };

  const loadRouters = async () => {
    try {
      const response = await fetch('/api/network/routers');
      const data = await response.json();
      setRouters(data.routers || []);
    } catch (error) {
      console.error('Load routers error:', error);
    }
  };

  const loadVpnClients = async () => {
    try {
      const response = await fetch('/api/network/vpn-clients');
      const data = await response.json();
      setVpnClients(data.clients || []);
    } catch (error) {
      console.error('Load VPN clients error:', error);
    }
  };

  const checkRoutersStatus = async () => {
    if (routers.length === 0) return;

    try {
      const routerIds = routers.map((r) => r.id);
      const response = await fetch('/api/network/routers/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routerIds }),
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMap(data.statusMap || {});
      }
    } catch (error) {
      console.error('Check status error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingRouter
        ? '/api/network/routers'
        : '/api/network/routers';
      const method = editingRouter ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingRouter ? { id: editingRouter.id, ...formData } : formData
        ),
      });

      if (response.ok) {
        const data = await response.json();
        setIsDialogOpen(false);
        setEditingRouter(null);
        setFormData({
          name: '',
          ipAddress: '',
          username: '',
          password: '',
          port: 8728,
          apiPort: 8729,
          secret: 'secret123',
          useVpn: false,
          vpnClientId: '',
        });

        if (!editingRouter && data.identity) {
          await showSuccess(
            `Router added successfully!\nRouter Identity: ${data.identity}`
          );
        } else if (editingRouter) {
          await showSuccess('Router updated successfully!');
        }

        loadRoutersAndStatus();
      } else {
        const error = await response.json();
        await showError(
          'Failed: ' +
            error.error +
            (error.hint ? '\n\n' + error.hint : '')
        );
      }
    } catch (error) {
      console.error('Save router error:', error);
      await showError('Failed to save router');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (router: Router) => {
    setEditingRouter(router);
    setFormData({
      name: router.name,
      ipAddress: router.ipAddress,
      username: router.username,
      password: router.password,
      port: router.port,
      apiPort: router.apiPort,
      secret: (router as any).secret || 'secret123',
      useVpn: !!(router as any).vpnClientId,
      vpnClientId: (router as any).vpnClientId || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteRouterId) return;
    
    const confirmed = await showConfirm('Are you sure you want to delete this router?');
    if (!confirmed) {
      setDeleteRouterId(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/network/routers?id=${deleteRouterId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await showSuccess('Router deleted successfully!');
        loadRouters();
      } else {
        const error = await response.json();
        await showError(error.error || 'Failed to delete router');
      }
    } catch (error) {
      console.error('Delete router error:', error);
      await showError('Failed to delete router');
    } finally {
      setDeleteRouterId(null);
    }
  };

  const togglePasswordVisibility = (routerId: string) => {
    setShowPassword((prev) => ({ ...prev, [routerId]: !prev[routerId] }));
  };

  const handleShowRadiusScript = async (router: Router) => {
    setRadiusScriptRouter(router);
    
    // Get RADIUS server IP from VPN clients marked as RADIUS server
    try {
      const response = await fetch('/api/network/vpn-clients');
      const data = await response.json();
      const radiusClient = data.clients?.find((c: any) => c.isRadiusServer);
      
      if (radiusClient) {
        setRadiusServerIp(radiusClient.vpnIp);
      } else {
        setRadiusServerIp(null);
      }
    } catch (error) {
      console.error('Load RADIUS server error:', error);
      setRadiusServerIp(null);
    }
    
    setShowRadiusScriptModal(true);
  };

  const generateRadiusScript = () => {
    if (!radiusScriptRouter) return '';
    
    const radiusServer = radiusServerIp || 'YOUR_RADIUS_SERVER_IP';
    const radiusSecret = (radiusScriptRouter as any).secret || 'secret123';
    
    return `# AIBILL RADIUS Setup Script
# Router: ${radiusScriptRouter.name}
# Generated: ${new Date().toLocaleString()}

# 1. Add RADIUS server
/radius add \\
  address=${radiusServer} \\
  secret=${radiusSecret} \\
  authentication-port=1812 \\
  accounting-port=1813 \\
  timeout=2s \\
  service=ppp,hotspot,login \\
  comment="AIBILL RADIUS Server"

# 2. Enable RADIUS for Hotspot profiles
/ip hotspot profile set \\
  use-radius=yes \\
  radius-accounting=yes \\
  radius-interim-update=00:10:00 \\
  nas-port-type=wireless-802.11 \\
  [find name!=""]

# 3. Enable RADIUS for PPP/PPPoE
/ppp aaa set \\
  use-radius=yes \\
  accounting=yes \\
  interim-update=00:10:00

# 4. Enable RADIUS incoming (for CoA/Disconnect)
/radius incoming set \\
  accept=yes \\
  port=3799

# Setup completed!
# Verify: /radius print
# Test: /radius test-authentication name=testuser password=testpass`;
  };

  const copyRadiusScript = () => {
    const script = generateRadiusScript();
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleSetupIsolir = async (routerId: string) => {
    setSettingUpIsolir(routerId);

    try {
      const res = await fetch(`/api/network/routers/${routerId}/setup-isolir`, {
        method: 'POST',
      });

      const result = await res.json();

      if (res.ok) {
        await showSuccess(`${result.message}\n\nConfig:\n- Profile: ${result.config.profile}\n- Rate Limit: ${result.config.rateLimit}\n- Pool: ${result.config.poolRange}`);
      } else {
        await showError(`Error: ${result.error}\n${result.details || ''}`);
      }
    } catch (error) {
      console.error('Setup isolir error:', error);
      await showError('Failed to setup isolir profile');
    } finally {
      setSettingUpIsolir(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const onlineCount = Object.values(statusMap).filter((s) => s.online).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            MikroTik Routers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Manage MikroTik routers for your network infrastructure
          </p>
        </div>

        <button
          onClick={() => {
            setEditingRouter(null);
            setFormData({
              name: '',
              ipAddress: '',
              username: '',
              password: '',
              port: 8728,
              apiPort: 8729,
              secret: 'secret123',
              useVpn: false,
              vpnClientId: '',
            });
            setIsDialogOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Router
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Routers
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {routers.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
              <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Online
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {onlineCount}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Offline
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {routers.length - onlineCount}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Routers Table */}
      <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Router
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Credentials
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Uptime
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {routers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No routers yet. Add your first router to get started.
                  </td>
                </tr>
              ) : (
                routers.map((router) => {
                  const status = statusMap[router.id];
                  return (
                    <tr
                      key={router.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {router.name}
                          </p>
                          {status?.identity && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {status.identity}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-mono text-gray-900 dark:text-white">
                          {router.ipAddress}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Port: {router.port}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            User: {router.username}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                              {showPassword[router.id]
                                ? router.password
                                : '••••••••'}
                            </p>
                            <button
                              onClick={() =>
                                togglePasswordVisibility(router.id)
                              }
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                            >
                              {showPassword[router.id] ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {status ? (
                          status.online ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              🟢 Online
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                              🔴 Offline
                            </span>
                          )
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                            ⚪ Checking...
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {status?.uptime || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleShowRadiusScript(router)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
                            title="RADIUS Setup Script"
                          >
                            <FileCode className="w-4 h-4" />
                            RADIUS
                          </button>
                          <button
                            onClick={() => handleSetupIsolir(router.id)}
                            disabled={settingUpIsolir === router.id}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Setup Isolir Profile"
                          >
                            <Shield className="w-4 h-4" />
                            {settingUpIsolir === router.id ? 'Setting...' : 'Isolir'}
                          </button>
                          <button
                            onClick={() => handleEdit(router)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Edit Router"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteRouterId(router.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                            title="Delete Router"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Router Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {editingRouter ? 'Edit Router' : 'Add Router'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {editingRouter
                ? 'Update router connection details'
                : 'Add a new MikroTik router to manage'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Router Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Main Router"
                  required
                />
              </div>

              {/* VPN Option */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.useVpn}
                    onChange={(e) => {
                      const useVpn = e.target.checked;
                      setFormData({ 
                        ...formData, 
                        useVpn,
                        ipAddress: useVpn ? '' : formData.ipAddress,
                        vpnClientId: useVpn ? formData.vpnClientId : '',
                      });
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Connect via VPN Client
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                  Use existing VPN client IP address
                </p>
              </div>

              {formData.useVpn ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select VPN Client *
                  </label>
                  <select
                    value={formData.vpnClientId}
                    onChange={(e) => {
                      const selectedClient = vpnClients.find(c => c.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        vpnClientId: e.target.value,
                        ipAddress: selectedClient ? selectedClient.vpnIp : '',
                      });
                    }}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  >
                    <option value="">-- Select VPN Client --</option>
                    {vpnClients
                      .filter((client) => {
                        // Filter out VPN clients that are RADIUS servers
                        if (client.isRadiusServer) return false;
                        
                        // Filter out VPN clients already used by other routers
                        const isUsed = routers.some(
                          (r) => (r as any).vpnClientId === client.id && (!editingRouter || r.id !== editingRouter.id)
                        );
                        return !isUsed;
                      })
                      .map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} - {client.vpnIp} ({client.vpnType})
                        </option>
                      ))}
                  </select>
                  {formData.vpnClientId && formData.ipAddress && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✓ Will connect to: {formData.ipAddress}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, ipAddress: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="192.168.88.1"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        port: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="8728"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API-SSL Port
                  </label>
                  <input
                    type="number"
                    value={formData.apiPort}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        apiPort: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="8729"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="admin"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  RADIUS Secret *
                </label>
                <input
                  type="text"
                  value={formData.secret}
                  onChange={(e) =>
                    setFormData({ ...formData, secret: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="secret123"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Shared secret for RADIUS authentication
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingRouter(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      {editingRouter ? 'Updating...' : 'Testing...'}
                    </>
                  ) : editingRouter ? (
                    'Update Router'
                  ) : (
                    'Add Router'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RADIUS Setup Script Modal */}
      {showRadiusScriptModal && radiusScriptRouter && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              RADIUS Setup Script
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Copy and paste this script to your MikroTik router terminal
            </p>

            {/* Router Info */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Router</p>
                  <p className="font-medium text-gray-900 dark:text-white">{radiusScriptRouter.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">RADIUS Server</p>
                  <p className="font-medium font-mono text-gray-900 dark:text-white">
                    {radiusServerIp || 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">RADIUS Secret</p>
                  <p className="font-medium font-mono text-gray-900 dark:text-white">
                    {(radiusScriptRouter as any).secret || 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Status</p>
                  {radiusServerIp && (radiusScriptRouter as any).secret ? (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      ✓ Ready to use
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                      ⚠ Incomplete
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Warning */}
            {(!radiusServerIp || !(radiusScriptRouter as any).secret) && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium mb-2">
                  ⚠️ Configuration Incomplete
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-500 space-y-1 list-disc list-inside">
                  {!radiusServerIp && (
                    <li>RADIUS server not set - mark a VPN client as RADIUS server in /admin/network/vpn-clients</li>
                  )}
                  {!(radiusScriptRouter as any).secret && (
                    <li>RADIUS Secret not set - edit router to add secret</li>
                  )}
                </ul>
              </div>
            )}

            {/* Script */}
            <div className="relative mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  MikroTik Script
                </label>
                <button
                  onClick={copyRadiusScript}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Script
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs overflow-x-auto font-mono max-h-96">
                {generateRadiusScript()}
              </pre>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl mb-4">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">📝 How to use:</p>
              <ol className="text-sm text-blue-700 dark:text-blue-500 space-y-1 list-decimal list-inside">
                <li>Copy the script above (click Copy button)</li>
                <li>Connect to your MikroTik router via Winbox or SSH</li>
                <li>Open New Terminal window</li>
                <li>Paste the entire script and press Enter</li>
                <li>Verify with: <code className="bg-blue-100 dark:bg-blue-950 px-1 rounded">/radius print</code></li>
              </ol>
            </div>

            <button
              onClick={() => setShowRadiusScriptModal(false)}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteRouterId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Delete Router
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to delete this router? This action cannot
              be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteRouterId(null)}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
