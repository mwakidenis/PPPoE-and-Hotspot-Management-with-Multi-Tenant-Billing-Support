'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';

import { useState, useEffect } from 'react';
import { 
  Shield, 
  Server, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Zap,
  Eye,
  Settings,
} from 'lucide-react';

interface VpnServerData {
  id: string;
  host: string;
  username: string;
  port: number;
  l2tpEnabled: boolean;
  sstpEnabled: boolean;
  pptpEnabled: boolean;
  isConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function VpnServerPage() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [vpnData, setVpnData] = useState<VpnServerData | null>(null);
  
  const [formData, setFormData] = useState({
    host: '',
    username: 'admin',
    password: '',
    port: '8728',
    subnet: '10.20.30.0/24',
  });

  const [testing, setTesting] = useState(false);
  const [setting, setSetting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    identity?: string;
  } | null>(null);

  useEffect(() => {
    loadVpnServer();
  }, []);

  const loadVpnServer = async () => {
    try {
      const response = await fetch('/api/network/vpn-server');
      const result = await response.json();
      
      if (result.configured && result.data) {
        setConfigured(true);
        setVpnData(result.data);
      }
    } catch (error) {
      console.error('Load VPN server error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/network/vpn-server/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formData.host,
          username: formData.username,
          password: formData.password,
          port: parseInt(formData.port),
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection failed: ' + (error as Error).message,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAutoSetup = async () => {
    if (!testResult?.success) {
      await showError('Please test connection first!');
      return;
    }

    const confirmed = await showConfirm('This will configure L2TP, SSTP, and PPTP on your CHR. Continue?');
    if (!confirmed) {
      return;
    }

    setSetting(true);

    try {
      const response = await fetch('/api/network/vpn-server/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formData.host,
          username: formData.username,
          password: formData.password,
          port: parseInt(formData.port),
          subnet: formData.subnet,
        }),
      });

      const result = await response.json();

      if (result.success) {
        await showSuccess('VPN Server configured successfully!\n\n' + 
          'L2TP: ' + (result.l2tp ? '✓' : '✗') + '\n' +
          'SSTP: ' + (result.sstp ? '✓' : '✗') + '\n' +
          'PPTP: ' + (result.pptp ? '✓' : '✗')
        );
        // Reload to show configured status
        loadVpnServer();
      } else {
        await showError('Setup failed: ' + result.message);
      }
    } catch (error) {
      await showError('Setup failed: ' + (error as Error).message);
    } finally {
      setSetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Show configured status
  if (configured && vpnData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            VPN Server
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Your VPN server is configured and ready
          </p>
        </div>

        <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              VPN Server Active
            </h2>
            <button
              onClick={() => {
                setConfigured(false);
                setVpnData(null);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Reconfigure
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                CHR Host
              </label>
              <p className="text-base font-mono text-gray-900 dark:text-white">
                {vpnData.host}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Username
              </label>
              <p className="text-base text-gray-900 dark:text-white">
                {vpnData.username}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                API Port
              </label>
              <p className="text-base text-gray-900 dark:text-white">
                {vpnData.port}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Configured At
              </label>
              <p className="text-base text-gray-900 dark:text-white">
                {new Date(vpnData.updatedAt).toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
              VPN Services Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={`p-4 rounded-xl border ${
                  vpnData.l2tpEnabled
                    ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {vpnData.l2tpEnabled ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium text-sm">L2TP/IPSec</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Port 1701, 500, 4500
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  vpnData.sstpEnabled
                    ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {vpnData.sstpEnabled ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium text-sm">SSTP</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Port 443
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  vpnData.pptpEnabled
                    ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {vpnData.pptpEnabled ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium text-sm">PPTP</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Port 1723
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
          VPN Server Setup
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Auto-configure L2TP, SSTP, and PPTP on MikroTik CHR
        </p>
      </div>

      {/* Connection Form */}
      <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Server className="w-5 h-5" />
          CHR Connection
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Host */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              CHR Host/IP *
            </label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              placeholder="192.168.1.1 or chr.example.com"
              required
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="admin"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Port */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Port
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="8728"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Default MikroTik API port is 8728
            </p>
          </div>

          {/* VPN Subnet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              VPN Subnet *
            </label>
            <input
              type="text"
              value={formData.subnet}
              onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              placeholder="10.20.30.0/24"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              VPN IP range for clients (editable)
            </p>
          </div>
        </div>

        {/* Test Connection Button */}
        <div className="mt-6">
          <button
            onClick={handleTestConnection}
            disabled={testing || !formData.host || !formData.username || !formData.password}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Test Connection
              </>
            )}
          </button>

          {/* Test Result */}
          {testResult && (
            <div
              className={`mt-4 p-4 rounded-xl border ${
                testResult.success
                  ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div>
                  <p
                    className={`font-semibold ${
                      testResult.success
                        ? 'text-green-900 dark:text-green-300'
                        : 'text-red-900 dark:text-red-300'
                    }`}
                  >
                    {testResult.message}
                  </p>
                  {testResult.identity && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Router Identity: <span className="font-mono">{testResult.identity}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auto Setup Section */}
      {testResult?.success && (
        <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-xl rounded-2xl border border-blue-200/50 dark:border-blue-800/50 p-6 shadow-xl">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Auto-Setup VPN Server
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure L2TP/IPSec, SSTP, and PPTP with one click
              </p>
            </div>
          </div>

          <div className="bg-white/50 dark:bg-gray-900/50 rounded-xl p-4 mb-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              What will be configured:
            </h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                L2TP/IPSec Server (Port 1701, 500, 4500)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                SSTP Server (Port 443)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                PPTP Server (Port 1723)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                IP Pool (custom subnet: {formData.subnet})
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                PPP Profile with DNS
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                NAT Masquerade
              </li>
            </ul>
          </div>

          <button
            onClick={handleAutoSetup}
            disabled={setting}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {setting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Configuring VPN Server...
              </>
            ) : (
              <>
                <Zap className="w-6 h-6" />
                Auto-Setup VPN Server Now
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
