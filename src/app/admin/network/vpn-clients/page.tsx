'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';

import { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Loader2,
  Trash2,
  Copy,
  CheckCircle2,
  Eye,
  XCircle,
} from 'lucide-react';

interface VpnClient {
  id: string;
  name: string;
  vpnIp: string;
  username: string;
  password: string;
  vpnType: string;
  description?: string;
  isActive: boolean;
  isRadiusServer?: boolean;
  createdAt: string;
}

interface Credentials {
  server: string;
  username: string;
  password: string;
  ipsecSecret: string;
  vpnIp: string;
}

export default function VpnClientsPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<VpnClient[]>([]);
  const [vpnServer, setVpnServer] = useState<any>(null);
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedVpnType, setSelectedVpnType] = useState('l2tp');
  const [selectedClient, setSelectedClient] = useState<VpnClient | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadClientsAndStatus();

    // Auto-refresh status every 30 seconds
    const interval = setInterval(() => {
      checkClientsStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadClientsAndStatus = async () => {
    try {
      const response = await fetch('/api/network/vpn-clients');
      const data = await response.json();
      const loadedClients = data.clients || [];
      setClients(loadedClients);
      setVpnServer(data.vpnServer);
      setLoading(false);

      // Immediately check status after loading clients
      if (loadedClients.length > 0) {
        const clientIds = loadedClients.map((c: VpnClient) => c.id);
        const statusResponse = await fetch('/api/network/vpn-clients/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientIds }),
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setStatusMap(statusData.statusMap || {});
        }
      }
    } catch (error) {
      console.error('Load clients error:', error);
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await fetch('/api/network/vpn-clients');
      const data = await response.json();
      setClients(data.clients || []);
      setVpnServer(data.vpnServer);
    } catch (error) {
      console.error('Load clients error:', error);
    }
  };

  const checkClientsStatus = async () => {
    if (clients.length === 0) return;
    if (!confirmed) return;

    try {
      const clientIds = clients.map((c) => c.id);
      const response = await fetch('/api/network/vpn-clients/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds }),
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
    setCreating(true);

    try {
      const response = await fetch('/api/network/vpn-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setIsDialogOpen(false);
        setFormData({ name: '', description: '' });

        // Show credentials modal
        setCredentials(data.credentials);
        setShowCredentials(true);

        loadClients();
      } else {
        const error = await response.json();
        alert('Failed: ' + error.error);
      }
    } catch (error) {
      console.error('Create client error:', error);
      alert('Failed to create VPN client');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteClientId) return;
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/network/vpn-clients?id=${deleteClientId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadClients();
      }
    } catch (error) {
      console.error('Delete client error:', error);
    } finally {
      setDeleteClientId(null);
    }
  };

  const handleViewConfig = (client: VpnClient) => {
    setSelectedClient(client);
    setSelectedVpnType(client.vpnType);
    setCredentials({
      server: vpnServer?.host || '',
      username: client.username,
      password: client.password,
      ipsecSecret: 'aibill-secret',
      vpnIp: client.vpnIp,
    });
    setShowCredentials(true);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleToggleRadiusServer = async (clientId: string, isRadiusServer: boolean) => {
    try {
      const response = await fetch('/api/network/vpn-clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clientId, isRadiusServer }),
      });

      if (response.ok) {
        loadClients();
      }
    } catch (error) {
      console.error('Toggle RADIUS server error:', error);
    }
  };

  const generateMikroTikScript = () => {
    if (!credentials) return '';
    
    // Get subnet from VPN server config
    const subnet = vpnServer?.subnet || '10.20.30.0/24';
    const subnetParts = subnet.split('/');
    const baseIp = subnetParts[0].split('.');
    const gateway = `${baseIp[0]}.${baseIp[1]}.${baseIp[2]}.1`;
    const subnetCidr = `${baseIp[0]}.${baseIp[1]}.${baseIp[2]}.0/24`;

    if (selectedVpnType === 'l2tp') {
      return `/interface l2tp-client add \\
  connect-to=${credentials.server} \\
  user=${credentials.username} \\
  password=${credentials.password} \\
  ipsec-secret=${credentials.ipsecSecret} \\
  disabled=no \\
  comment="AIBILL VPN"

# Add static route for VPN subnet
/ip route add dst-address=${subnetCidr} gateway=${gateway} comment="AIBILL VPN Route"`;
    } else if (selectedVpnType === 'sstp') {
      return `/interface sstp-client add \\
  connect-to=${credentials.server} \\
  user=${credentials.username} \\
  password=${credentials.password} \\
  disabled=no \\
  verify-server-certificate=no \\
  comment="AIBILL VPN"

# Add static route for VPN subnet
/ip route add dst-address=${subnetCidr} gateway=${gateway} comment="AIBILL VPN Route"`;
    } else if (selectedVpnType === 'pptp') {
      return `/interface pptp-client add \\
  connect-to=${credentials.server} \\
  user=${credentials.username} \\
  password=${credentials.password} \\
  disabled=no \\
  comment="AIBILL VPN"

# Add static route for VPN subnet
/ip route add dst-address=${subnetCidr} gateway=${gateway} comment="AIBILL VPN Route"`;
    }

    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            VPN Clients
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Manage VPN clients for branches and routers
          </p>
        </div>

        <button
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium"
        >
          <Plus className="w-4 h-4" />
          Add VPN Client
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Clients
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {clients.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
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
                {Object.values(statusMap).filter(Boolean).length}
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
                VPN Type
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                L2TP
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Client Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  VPN IP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  RADIUS Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No VPN clients yet. Add your first client to get started.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {client.name}
                        </p>
                        {client.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {client.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                      {client.vpnIp}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-mono text-gray-900 dark:text-white">
                          {client.username}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                          {client.vpnType}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={client.isRadiusServer || false}
                          onChange={(e) => handleToggleRadiusServer(client.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {client.isRadiusServer ? 'Default RADIUS' : 'Set as RADIUS'}
                        </span>
                      </label>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {statusMap[client.id] === true ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                          🟢 Online
                        </span>
                      ) : statusMap[client.id] === false ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                          🔴 Offline
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                          ⚪ Checking...
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewConfig(client)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="View Configuration"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteClientId(client.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                          title="Delete Client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Add VPN Client
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Create a new VPN client. Credentials will be auto-generated.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Branch-Jakarta"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This will be used to generate username
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="FreeRADIUS Server"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create VPN Client'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentials && credentials && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              VPN Configuration
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Copy the configuration below to setup VPN client
            </p>

            <div className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Server
                    </label>
                    <p className="font-mono text-sm text-gray-900 dark:text-white">
                      {credentials.server}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      VPN IP
                    </label>
                    <p className="font-mono text-sm text-gray-900 dark:text-white">
                      {credentials.vpnIp}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Username
                    </label>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm text-gray-900 dark:text-white">
                        {credentials.username}
                      </p>
                      <button
                        onClick={() => copyToClipboard(credentials.username, 'username')}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"
                      >
                        {copiedField === 'username' ? (
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Password
                    </label>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm text-gray-900 dark:text-white">
                        {credentials.password}
                      </p>
                      <button
                        onClick={() => copyToClipboard(credentials.password, 'password')}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"
                      >
                        {copiedField === 'password' ? (
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  {selectedVpnType === 'l2tp' && (
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        IPSec Secret
                      </label>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm text-gray-900 dark:text-white">
                          {credentials.ipsecSecret}
                        </p>
                        <button
                          onClick={() => copyToClipboard(credentials.ipsecSecret, 'secret')}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"
                        >
                          {copiedField === 'secret' ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* VPN Type Selector */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Select VPN Type for MikroTik Script
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedVpnType('l2tp')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedVpnType === 'l2tp'
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      L2TP
                    </button>
                    <button
                      onClick={() => setSelectedVpnType('sstp')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedVpnType === 'sstp'
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      SSTP
                    </button>
                    <button
                      onClick={() => setSelectedVpnType('pptp')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedVpnType === 'pptp'
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      PPTP
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    MikroTik Script
                  </label>
                  <button
                    onClick={() => copyToClipboard(generateMikroTikScript(), 'script')}
                    className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    {copiedField === 'script' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
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
                <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl text-xs overflow-auto max-h-48 whitespace-pre font-mono">
                  {generateMikroTikScript()}
                </pre>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowCredentials(false)}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteClientId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Delete VPN Client
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure? This will remove the client from CHR and database.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteClientId(null)}
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
