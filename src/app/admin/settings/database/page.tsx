'use client';

import { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Send,
  Trash2,
  HardDrive,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { usePermissions } from '@/hooks/usePermissions';
import { formatWIB } from '@/lib/timezone';

interface BackupHistory {
  id: string;
  filename: string;
  filesize: number;
  type: 'auto' | 'manual';
  status: 'success' | 'failed';
  method: string;
  createdAt: string;
  error?: string;
}

interface DatabaseHealth {
  status: 'healthy' | 'warning' | 'error';
  size: string;
  tables: number;
  connections: string;
  lastBackup: string | null;
  uptime: string;
}

interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  backupTopicId: string;
  healthTopicId: string;
  schedule: string;
  scheduleTime: string;
  keepLastN: number;
}

export default function DatabaseSettingsPage() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState<'backup' | 'telegram'>('backup');
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>({
    enabled: false,
    botToken: '',
    chatId: '',
    backupTopicId: '',
    healthTopicId: '',
    schedule: 'daily',
    scheduleTime: '02:00',
    keepLastN: 7,
  });

  useEffect(() => {
    if (hasPermission('settings.view')) {
      loadData();
    }
  }, [hasPermission]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load backup history
      const historyRes = await fetch('/api/backup/history');
      const historyData = await historyRes.json();
      if (historyData.success) {
        setBackupHistory(historyData.history);
      }

      // Load DB health
      const healthRes = await fetch('/api/backup/health');
      const healthData = await healthRes.json();
      if (healthData.success) {
        setDbHealth(healthData.health);
      }

      // Load Telegram settings
      const settingsRes = await fetch('/api/telegram/settings');
      const settingsData = await settingsRes.json();
      setTelegramSettings(settingsData);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupNow = async () => {
    const confirmed = await showConfirm('Create database backup now? This may take a few minutes.');
    if (!confirmed) return;

    setBacking(true);
    try {
      const res = await fetch('/api/backup/create', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        await showSuccess('Backup created successfully!');
        loadData();
        
        // Download file
        if (data.downloadUrl) {
          const link = document.createElement('a');
          link.href = data.downloadUrl;
          link.download = data.filename;
          link.click();
        }
      } else {
        await showError(data.error || 'Backup failed');
      }
    } catch (error) {
      await showError('Failed to create backup: ' + error);
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      await showError('Please select a backup file first');
      return;
    }

    const confirmed = await showConfirm(
      'WARNING: This will restore the database and overwrite all current data. Are you absolutely sure?'
    );
    if (!confirmed) return;

    const doubleConfirm = await showConfirm(
      'Last confirmation: Type YES to proceed with database restore.',
      true
    );
    if (!doubleConfirm) return;

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.success) {
        await showSuccess('Database restored successfully! Please reload the page.');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        await showError(data.error || 'Restore failed');
      }
    } catch (error) {
      await showError('Failed to restore: ' + error);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (id: string, filename: string) => {
    const confirmed = await showConfirm(`Delete backup: ${filename}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/backup/delete/${id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        await showSuccess('Backup deleted');
        loadData();
      } else {
        await showError(data.error || 'Delete failed');
      }
    } catch (error) {
      await showError('Failed to delete: ' + error);
    }
  };

  const handleSaveTelegramSettings = async () => {
    try {
      const res = await fetch('/api/telegram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramSettings),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Restart cron jobs to apply new settings
        await fetch('/api/cron/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restart', job: 'all' }),
        });
        
        await showSuccess('Telegram settings saved and cron jobs restarted!');
        loadData();
      } else {
        await showError(data.error || 'Save failed');
      }
    } catch (error) {
      await showError('Failed to save: ' + error);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramSettings.botToken || !telegramSettings.chatId) {
      await showError('Please enter Bot Token and Chat ID first');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramSettings.botToken,
          chatId: telegramSettings.chatId,
          backupTopicId: telegramSettings.backupTopicId || undefined,
          healthTopicId: telegramSettings.healthTopicId || undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        const count = data.results?.length || 0;
        await showSuccess(`Test messages sent to ${count} location(s)! Check your Telegram.`);
      } else {
        await showError(data.error || 'Connection test failed');
      }
    } catch (error) {
      await showError('Failed to test: ' + error);
    } finally {
      setTesting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Permission check
  const canView = hasPermission('settings.view');
  const canEdit = hasPermission('settings.edit');

  if (!permLoading && !canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Shield className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Access Denied
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          You don't have permission to view database settings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Database Management
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Backup, restore, and monitor your database
        </p>
      </div>

      {/* Database Health Status */}
      {dbHealth && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Database Health
            </h2>
            <div className="flex items-center gap-2">
              {dbHealth.status === 'healthy' && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  Healthy
                </span>
              )}
              {dbHealth.status === 'warning' && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="w-5 h-5" />
                  Warning
                </span>
              )}
              {dbHealth.status === 'error' && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  Error
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Database Size</p>
              <p className="text-lg font-semibold">{dbHealth.size}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Tables</p>
              <p className="text-lg font-semibold">{dbHealth.tables}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Connections</p>
              <p className="text-lg font-semibold">{dbHealth.connections}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Last Backup</p>
              <p className="text-lg font-semibold">
                {dbHealth.lastBackup ? formatWIB(dbHealth.lastBackup, 'dd/MM HH:mm') : 'Never'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Uptime</p>
              <p className="text-lg font-semibold">{dbHealth.uptime}</p>
            </div>
            <div>
              <button
                onClick={loadData}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-2 border-b-2 transition ${
              activeTab === 'backup'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Backup & Restore
            </div>
          </button>
          <button
            onClick={() => setActiveTab('telegram')}
            className={`px-4 py-2 border-b-2 transition ${
              activeTab === 'telegram'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Telegram Auto-Backup
            </div>
          </button>
        </div>
      </div>

      {/* Backup Tab */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Manual Backup/Restore */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Backup Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Create Backup
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Download a complete backup of your database as SQL file
              </p>
              <button
                onClick={handleBackupNow}
                disabled={backing || !canEdit}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium"
              >
                {backing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Backup Now
                  </>
                )}
              </button>
            </div>

            {/* Restore Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Restore Database
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Upload and restore database from backup file (.sql)
              </p>
              <input
                type="file"
                accept=".sql"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="block w-full text-sm mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-blue-400"
                disabled={!canEdit}
              />
              <button
                onClick={handleRestore}
                disabled={!restoreFile || restoring || !canEdit}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium"
              >
                {restoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Restore Database
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Backup History */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Backup History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Filename
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {backupHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No backup history yet
                      </td>
                    </tr>
                  ) : (
                    backupHistory.map((backup) => (
                      <tr key={backup.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 text-sm">
                          {formatWIB(backup.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono">
                          {backup.filename}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {formatFileSize(backup.filesize)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              backup.type === 'auto'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                            }`}
                          >
                            {backup.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {backup.status === 'success' ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              Success
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="w-4 h-4" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `/api/backup/download/${backup.id}`;
                                link.download = backup.filename;
                                link.click();
                              }}
                              className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteBackup(backup.id, backup.filename)}
                                className="text-red-600 hover:text-red-800 dark:hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Tab */}
      {activeTab === 'telegram' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Send className="w-5 h-5" />
              Telegram Auto-Backup Configuration
            </h3>

            <div className="space-y-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <label className="font-medium">Enable Auto-Backup</label>
                  <p className="text-sm text-gray-500">Automatically backup database to Telegram</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={telegramSettings.enabled}
                    onChange={(e) =>
                      setTelegramSettings({ ...telegramSettings, enabled: e.target.checked })
                    }
                    className="sr-only peer"
                    disabled={!canEdit}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Bot Token */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  value={telegramSettings.botToken || ''}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, botToken: e.target.value })
                  }
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  disabled={!canEdit}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get token from @BotFather on Telegram
                </p>
              </div>

              {/* Chat ID */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Chat ID (Group)
                </label>
                <input
                  type="text"
                  value={telegramSettings.chatId || ''}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, chatId: e.target.value })
                  }
                  placeholder="-1001234567890"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  disabled={!canEdit}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get Chat ID from @userinfobot or your group
                </p>
              </div>

              {/* Backup Topic ID */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Backup Topic ID
                </label>
                <input
                  type="text"
                  value={telegramSettings.backupTopicId || ''}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, backupTopicId: e.target.value })
                  }
                  placeholder="123"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  disabled={!canEdit}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Topic ID for backup messages (right-click topic → Copy Link → extract ID)
                </p>
              </div>

              {/* Health Topic ID */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Health Topic ID (Optional)
                </label>
                <input
                  type="text"
                  value={telegramSettings.healthTopicId || ''}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, healthTopicId: e.target.value })
                  }
                  placeholder="456"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  disabled={!canEdit}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Topic ID for health check reports
                </p>
              </div>

              {/* Schedule */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Schedule
                  </label>
                  <select
                    value={telegramSettings.schedule || 'daily'}
                    onChange={(e) =>
                      setTelegramSettings({ ...telegramSettings, schedule: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    disabled={!canEdit}
                  >
                    <option value="daily">Daily</option>
                    <option value="12h">Every 12 Hours</option>
                    <option value="6h">Every 6 Hours</option>
                    <option value="weekly">Weekly (Sunday)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Time (WIB)
                  </label>
                  <input
                    type="time"
                    value={telegramSettings.scheduleTime || '00:00'}
                    onChange={(e) =>
                      setTelegramSettings({ ...telegramSettings, scheduleTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {/* Keep Last N */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Keep Last Backups
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={telegramSettings.keepLastN || 7}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, keepLastN: parseInt(e.target.value) || 7 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  disabled={!canEdit}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Automatically delete old backups, keep only last N files
                </p>
              </div>

              {/* Action Buttons */}
              {canEdit && (
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button
                    onClick={handleTestTelegram}
                    disabled={testing}
                    className="px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Test Connection
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSaveTelegramSettings}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                  >
                    Save Settings
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-400 mb-2">
              📘 How to Setup Telegram Backup
            </h4>
            <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
              <li>Create a bot via @BotFather on Telegram and get the Bot Token</li>
              <li>Create a group, add your bot as admin</li>
              <li>Enable Topics in group settings</li>
              <li>Create topics: "Backup" and "Health"</li>
              <li>Get Chat ID from @getidsbot in your group</li>
              <li>Right-click each topic → Copy Link → extract topic ID from URL</li>
              <li>Enter all credentials above and click "Test"</li>
              <li>Click "Test Backup" to send actual backup file</li>
              <li>Enable auto-backup and save settings</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
