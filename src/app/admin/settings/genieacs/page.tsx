'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Server,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  MoreVertical,
  Power,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import Swal from 'sweetalert2';

type TabType = 'devices' | 'settings';

export default function GenieACSPage() {
  const [activeTab, setActiveTab] = useState<TabType>('devices');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    host: '',
    username: '',
    password: '',
  });

  const [savedSettings, setSavedSettings] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'devices') {
      loadDevices();
    }
  }, [activeTab]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings/genieacs');
      const data = await res.json();
      if (data.settings) {
        setSavedSettings(data.settings);
        setSettingsForm({
          host: data.settings.host,
          username: data.settings.username,
          password: '', // Don't load password for security
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!settingsForm.host || !settingsForm.username || !settingsForm.password) {
      Swal.fire('Error', 'Please fill in all fields', 'error');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/settings/genieacs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Connection Successful!',
          text: data.message,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Connection Failed',
          text: data.error,
        });
      }
    } catch (error: any) {
      Swal.fire('Error', error.message || 'Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsForm.host || !settingsForm.username || !settingsForm.password) {
      Swal.fire('Error', 'Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/settings/genieacs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Success', 'Settings saved successfully!', 'success');
        loadSettings();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      Swal.fire('Error', error.message || 'Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/genieacs/devices');
      const data = await res.json();

      if (data.success) {
        setDevices(data.devices || []);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      Swal.fire('Error', error.message || 'Failed to load devices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceAction = async (deviceId: string, action: string) => {
    const actions: any = {
      reboot: { name: 'Reboot', task: 'reboot', icon: '🔄' },
      factoryReset: { name: 'Factory Reset', task: 'factoryReset', icon: '🏭' },
      refresh: { name: 'Refresh Parameters', task: 'getParameterValues', icon: '🔃' },
    };

    const actionData = actions[action];
    if (!actionData) return;

    const result = await Swal.fire({
      title: `${actionData.icon} ${actionData.name}?`,
      text: `Execute ${actionData.name} on device ${deviceId}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: action === 'factoryReset' ? '#EF4444' : '#3B82F6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Yes, ${actionData.name}!`,
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch('/api/settings/genieacs/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          taskName: actionData.task,
        }),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Success!', `${actionData.name} task queued successfully`, 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      Swal.fire('Error', error.message || `Failed to execute ${actionData.name}`, 'error');
    }
  };

  const tabs = [
    { id: 'devices' as TabType, label: 'Devices', icon: Server, count: devices.length },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings, count: null },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">GenieACS</h1>
          <p className="text-gray-500 mt-1">Manage TR-069 devices and configuration</p>
        </div>
        <Button onClick={activeTab === 'devices' ? loadDevices : loadSettings} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== null && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>GenieACS Connection Settings</CardTitle>
            <CardDescription>
              Configure connection to your GenieACS server
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4 max-w-2xl">
              <div>
                <Label htmlFor="host">Host URL *</Label>
                <Input
                  id="host"
                  value={settingsForm.host}
                  onChange={(e) => setSettingsForm({ ...settingsForm, host: e.target.value })}
                  placeholder="http://localhost:7557"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Full URL to your GenieACS server (e.g., http://192.168.1.100:7557)
                </p>
              </div>

              <div>
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={settingsForm.username}
                  onChange={(e) => setSettingsForm({ ...settingsForm, username: e.target.value })}
                  placeholder="admin"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={settingsForm.password}
                    onChange={(e) => setSettingsForm({ ...settingsForm, password: e.target.value })}
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {savedSettings && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Settings saved</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Connection configured for {savedSettings.host}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={handleTestConnection}
                  variant="outline"
                  disabled={testing || !settingsForm.host || !settingsForm.username || !settingsForm.password}
                >
                  {testing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Server className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={loading || !settingsForm.host || !settingsForm.username || !settingsForm.password}
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <Card>
          <CardHeader>
            <CardTitle>CPE Devices</CardTitle>
            <CardDescription>
              List of all TR-069 devices managed by GenieACS
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!savedSettings ? (
              <div className="text-center py-12">
                <XCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">GenieACS not configured</p>
                <p className="text-sm text-gray-500 mb-4">
                  Please configure connection settings first
                </p>
                <Button onClick={() => setActiveTab('settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Go to Settings
                </Button>
              </div>
            ) : loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
                <p className="text-gray-600">Loading devices...</p>
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-12">
                <Server className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No devices found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-3 py-2 font-semibold">Serial Number</th>
                      <th className="text-left px-3 py-2 font-semibold">Manufacturer</th>
                      <th className="text-left px-3 py-2 font-semibold">Model</th>
                      <th className="text-left px-3 py-2 font-semibold">IP TR069</th>
                      <th className="text-left px-3 py-2 font-semibold">PPPoE User</th>
                      <th className="text-left px-3 py-2 font-semibold">PPPoE IP</th>
                      <th className="text-left px-3 py-2 font-semibold">PON Mode</th>
                      <th className="text-left px-3 py-2 font-semibold">RX Power</th>
                      <th className="text-left px-3 py-2 font-semibold">Uptime</th>
                      <th className="text-left px-3 py-2 font-semibold">Last Inform</th>
                      <th className="text-left px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device) => {
                      // Helper function to get parameter value
                      const getParam = (path: string, fallbacks: string[] = []) => {
                        const tryPath = (p: string) => {
                          const keys = p.split('.');
                          let value = device;
                          for (const key of keys) {
                            if (value && typeof value === 'object' && key in value) {
                              value = value[key];
                            } else {
                              return null;
                            }
                          }
                          // If value is array with _value, get first item
                          if (Array.isArray(value) && value[0] && '_value' in value[0]) {
                            return value[0]._value;
                          }
                          // If value has _value property
                          if (value && typeof value === 'object' && '_value' in value) {
                            return value._value;
                          }
                          return value;
                        };

                        // Try main path first
                        let result = tryPath(path);
                        if (result && result !== null && result !== '') return result;

                        // Try fallback paths
                        for (const fallback of fallbacks) {
                          result = tryPath(fallback);
                          if (result && result !== null && result !== '') return result;
                        }

                        return '-';
                      };

                      return (
                        <tr key={device._id} className="hover:bg-gray-50 border-b">
                          <td className="px-3 py-2 font-mono text-xs">
                            {getParam('VirtualParameters.getSerialNumber')}
                          </td>
                          <td className="px-3 py-2">
                            {getParam('DeviceID.Manufacturer', [
                              '_deviceId.Manufacturer',
                              'DeviceID.Manufacturer._value',
                              'InternetGatewayDevice.DeviceInfo.Manufacturer._value',
                              'Device.DeviceInfo.Manufacturer._value',
                              'InternetGatewayDevice.DeviceInfo.Manufacturer.0._value'
                            ]) || device._deviceId?.Manufacturer || '-'}
                          </td>
                          <td className="px-3 py-2">
                            {getParam('DeviceID.ProductClass', [
                              '_deviceId.ProductClass',
                              'DeviceID.ProductClass._value',
                              'InternetGatewayDevice.DeviceInfo.ModelName._value',
                              'Device.DeviceInfo.ModelName._value',
                              'InternetGatewayDevice.DeviceInfo.ProductClass._value',
                              'InternetGatewayDevice.DeviceInfo.ProductClass.0._value'
                            ]) || device._deviceId?.ProductClass || '-'}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {getParam('VirtualParameters.IPTR069')}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {getParam('VirtualParameters.pppoeUsername2') !== '-' 
                              ? getParam('VirtualParameters.pppoeUsername2')
                              : getParam('VirtualParameters.pppoeUsername')}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {getParam('VirtualParameters.pppoeIP')}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              getParam('VirtualParameters.getponmode') === 'GPON'
                                ? 'bg-blue-100 text-blue-700'
                                : getParam('VirtualParameters.getponmode') === 'EPON'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {getParam('VirtualParameters.getponmode')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-mono ${
                              parseFloat(getParam('VirtualParameters.RXPower')) < -25
                                ? 'text-red-600 font-semibold'
                                : parseFloat(getParam('VirtualParameters.RXPower')) < -20
                                ? 'text-orange-600'
                                : 'text-green-600'
                            }`}>
                              {getParam('VirtualParameters.RXPower')} dBm
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {getParam('VirtualParameters.getdeviceuptime')}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {device._lastInform ? new Date(device._lastInform).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDeviceAction(device._id, 'refresh')}
                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                                title="Refresh Parameters"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeviceAction(device._id, 'reboot')}
                                className="p-1.5 hover:bg-orange-50 text-orange-600 rounded transition-colors"
                                title="Reboot Device"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeviceAction(device._id, 'factoryReset')}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded transition-colors"
                                title="Factory Reset"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
