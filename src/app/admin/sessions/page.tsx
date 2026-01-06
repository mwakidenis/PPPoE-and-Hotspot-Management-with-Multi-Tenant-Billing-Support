'use client';

import { useEffect, useState } from 'react';
import { Activity, Filter, Power, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import Swal from 'sweetalert2';

interface Session {
  id: string;
  username: string;
  sessionId: string;
  type: 'pppoe' | 'hotspot';
  nasIpAddress: string;
  framedIpAddress: string;
  macAddress: string;
  startTime: string;
  duration: number;
  durationFormatted: string;
  uploadFormatted: string;
  downloadFormatted: string;
  totalFormatted: string;
  router: { id: string; name: string } | null;
  user: { id: string; name: string; phone: string; profile: string } | null;
  voucher: { id: string; status: string; profile: string } | null;
}

interface Stats {
  total: number;
  pppoe: number;
  hotspot: number;
  totalBandwidthFormatted: string;
}

interface AllTimeStats {
  totalSessions: number;
  totalBandwidthFormatted: string;
  totalDurationFormatted: string;
}

interface Router {
  id: string;
  name: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | null>(null);
  const [routers, setRouters] = useState<Router[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [disconnecting, setDisconnecting] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [routerFilter, setRouterFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const fetchSessions = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (routerFilter) params.set('routerId', routerFilter);
      if (searchFilter) params.set('search', searchFilter);

      const res = await fetch(`/api/sessions?${params}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setStats(data.stats);
      setAllTimeStats(data.allTimeStats);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRouters = async () => {
    try {
      const res = await fetch('/api/network/routers');
      const data = await res.json();
      setRouters(data.routers || []);
    } catch (error) {
      console.error('Failed to fetch routers:', error);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [typeFilter, routerFilter, searchFilter]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSessions(new Set(sessions.map(s => s.sessionId)));
    } else {
      setSelectedSessions(new Set());
    }
  };

  const handleSelectSession = (sessionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSessions);
    if (checked) {
      newSelected.add(sessionId);
    } else {
      newSelected.delete(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleDisconnect = async (sessionIds: string[]) => {
    const result = await Swal.fire({
      title: 'Disconnect Sessions?',
      text: `Are you sure you want to disconnect ${sessionIds.length} session(s)?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, disconnect',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setDisconnecting(true);
    try {
      const res = await fetch('/api/sessions/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds }),
      });

      const data = await res.json();
      
      if (data.success) {
        await Swal.fire({
          title: 'Success!',
          html: `<div class="text-left"><p>Disconnected: <strong class="text-green-600">${data.summary.successful}</strong></p><p>Failed: <strong class="text-red-600">${data.summary.failed}</strong></p></div>`,
          icon: 'success',
          confirmButtonColor: '#2563EB'
        });
        setSelectedSessions(new Set());
        await fetchSessions();
      } else {
        await Swal.fire({
          title: 'Error',
          text: 'Failed to disconnect sessions',
          icon: 'error',
          confirmButtonColor: '#2563EB'
        });
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      await Swal.fire({
        title: 'Error',
        text: 'Error disconnecting sessions',
        icon: 'error',
        confirmButtonColor: '#2563EB'
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleBulkDisconnect = () => {
    const sessionIds = Array.from(selectedSessions);
    handleDisconnect(sessionIds);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Active Sessions
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor and manage active user sessions
          </p>
        </div>
        <button
          onClick={fetchSessions}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Active Sessions Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Active Sessions</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 flex items-center gap-1">
              <Wifi className="w-4 h-4" />
              PPPoE
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.pppoe}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 flex items-center gap-1">
              <WifiOff className="w-4 h-4" />
              Hotspot
            </div>
            <div className="text-2xl font-bold text-orange-600">{stats.hotspot}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Active Bandwidth</div>
            <div className="text-2xl font-bold text-green-600">{stats.totalBandwidthFormatted}</div>
          </div>
        </div>
      )}

      {/* All-Time Stats */}
      {allTimeStats && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            All-Time Statistics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Sessions (All Time)</div>
              <div className="text-3xl font-bold text-gray-900">{allTimeStats.totalSessions.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Bandwidth Used</div>
              <div className="text-3xl font-bold text-blue-600">{allTimeStats.totalBandwidthFormatted}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Duration</div>
              <div className="text-3xl font-bold text-indigo-600">{allTimeStats.totalDurationFormatted}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-col md:flex-row gap-3 flex-1">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Types</option>
              <option value="pppoe">PPPoE</option>
              <option value="hotspot">Hotspot</option>
            </select>

            <select
              value={routerFilter}
              onChange={(e) => setRouterFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Routers</option>
              {routers.map(router => (
                <option key={router.id} value={router.id}>
                  {router.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search username or IP..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]"
            />
          </div>

          {selectedSessions.size > 0 && (
            <button
              onClick={handleBulkDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Power className="w-4 h-4" />
              Disconnect ({selectedSessions.size})
            </button>
          )}
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedSessions.size === sessions.length && sessions.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User/Voucher</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Router</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Upload</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Download</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    No active sessions
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.sessionId)}
                        onChange={(e) => handleSelectSession(session.sessionId, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        session.type === 'pppoe' 
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {session.type === 'pppoe' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {session.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{session.username}</td>
                    <td className="px-4 py-3 text-sm">
                      {session.user && (
                        <div>
                          <div className="font-medium text-gray-900">{session.user.name}</div>
                          <div className="text-gray-500">{session.user.profile}</div>
                        </div>
                      )}
                      {session.voucher && (
                        <div>
                          <div className="font-medium text-gray-900">{session.voucher.profile}</div>
                          <div className={`text-xs ${
                            session.voucher.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {session.voucher.status}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {session.router?.name || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">
                      {session.framedIpAddress}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {session.durationFormatted}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{session.uploadFormatted}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{session.downloadFormatted}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{session.totalFormatted}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDisconnect([session.sessionId])}
                        disabled={disconnecting}
                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Disconnect"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
