'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  Wifi,
  Receipt,
  TrendingUp,
  Activity,
  Clock,
  DollarSign,
  Loader2,
  Server,
  Database,
  Zap,
  CheckCircle2,
  XCircle,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { formatWIB, getTimezoneInfo } from '@/lib/timezone';

interface StatCard {
  title: string;
  value: string | number;
  change?: string | null;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
}

interface DashboardData {
  stats: {
    totalUsers: { value: number; change: string };
    activeSessions: { value: number; change: string | null };
    pendingInvoices: { value: number; change: string };
    revenue: { value: string; change: string };
  };
  network: {
    pppoeUsers: number;
    hotspotSessions: number;
    bandwidth: string;
  };
  activities: RecentActivity[];
  systemStatus?: {
    radius: boolean;
    database: boolean;
    api: boolean;
  };
}

interface RadiusStatus {
  status: 'running' | 'stopped';
  uptime: string;
}

interface RecentActivity {
  id: string;
  user: string;
  action: string;
  time: string;
  status: 'success' | 'warning' | 'error';
}

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const tzInfo = getTimezoneInfo();
  const [currentTime, setCurrentTime] = useState('');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [radiusStatus, setRadiusStatus] = useState<RadiusStatus | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadDashboardData();
    loadRadiusStatus();
    setCurrentTime(formatWIB(new Date(), 'HH:mm:ss'));
    
    const timeInterval = setInterval(() => {
      setCurrentTime(formatWIB(new Date(), 'HH:mm:ss'));
    }, 1000);

    // Refresh data every 30 seconds
    const dataInterval = setInterval(() => {
      loadDashboardData();
      loadRadiusStatus();
    }, 30000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(dataInterval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRadiusStatus = async () => {
    try {
      const res = await fetch('/api/system/radius');
      const data = await res.json();
      if (data.success) {
        setRadiusStatus(data);
      }
    } catch (error) {
      console.error('Failed to load RADIUS status:', error);
    }
  };

  const handleRestartRadius = async () => {
    const result = await Swal.fire({
      title: 'Restart RADIUS Server?',
      text: 'This will temporarily disconnect all active sessions.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Restart',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) return;

    setRestarting(true);
    try {
      const res = await fetch('/api/system/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });

      const data = await res.json();
      if (data.success) {
        Swal.fire('Success!', 'RADIUS server restarted successfully', 'success');
        loadRadiusStatus();
        loadDashboardData();
      } else {
        Swal.fire('Error!', data.error || 'Failed to restart RADIUS', 'error');
      }
    } catch (error) {
      console.error('Restart error:', error);
      Swal.fire('Error!', 'Failed to restart RADIUS server', 'error');
    } finally {
      setRestarting(false);
    }
  };

  const getStats = (): StatCard[] => {
    if (!dashboardData) {
      return [
        {
          title: 'Total Users',
          value: '-',
          change: null,
          icon: <Users className="w-6 h-6" />,
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          iconColor: 'text-blue-600 dark:text-blue-400',
        },
        {
          title: 'Active Sessions',
          value: '-',
          change: null,
          icon: <Activity className="w-6 h-6" />,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          iconColor: 'text-green-600 dark:text-green-400',
        },
        {
          title: 'Pending Invoices',
          value: '-',
          change: null,
          icon: <Receipt className="w-6 h-6" />,
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
        },
        {
          title: 'Revenue',
          value: '-',
          change: null,
          icon: <DollarSign className="w-6 h-6" />,
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          iconColor: 'text-purple-600 dark:text-purple-400',
        },
      ];
    }

    return [
      {
        title: 'Total Users',
        value: dashboardData.stats.totalUsers.value.toLocaleString(),
        change: dashboardData.stats.totalUsers.change,
        icon: <Users className="w-6 h-6" />,
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        iconColor: 'text-blue-600 dark:text-blue-400',
      },
      {
        title: 'Active Sessions',
        value: dashboardData.stats.activeSessions.value.toLocaleString(),
        change: dashboardData.stats.activeSessions.change,
        icon: <Activity className="w-6 h-6" />,
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        iconColor: 'text-green-600 dark:text-green-400',
      },
      {
        title: 'Pending Invoices',
        value: dashboardData.stats.pendingInvoices.value.toLocaleString(),
        change: dashboardData.stats.pendingInvoices.change,
        icon: <Receipt className="w-6 h-6" />,
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
      },
      {
        title: 'Revenue This Month',
        value: dashboardData.stats.revenue.value,
        change: dashboardData.stats.revenue.change,
        icon: <DollarSign className="w-6 h-6" />,
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        iconColor: 'text-purple-600 dark:text-purple-400',
      },
    ];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            {tzInfo.name} ({tzInfo.offset}) • {currentTime}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          getStats().map((stat) => (
          <div
            key={stat.title}
            className="group relative bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {stat.value}
                </p>
                {stat.change && (
                  <p
                    className={`text-xs font-medium mt-2 ${
                      stat.change.startsWith('+')
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {stat.change} from last month
                  </p>
                )}
              </div>
              <div
                className={`${stat.bgColor} ${stat.iconColor} p-3.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}
              >
                {stat.icon}
              </div>
            </div>
          </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activities
          </h2>
          <div className="space-y-4">
            {!dashboardData || dashboardData.activities.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activities</p>
              </div>
            ) : (
              dashboardData.activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {activity.user}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {activity.action}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatWIB(activity.time, 'HH:mm')}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 text-xs font-medium rounded mt-1 ${
                      activity.status === 'success'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : activity.status === 'warning'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}
                  >
                    {activity.status}
                  </span>
                </div>
              </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Network Overview
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    PPPoE Users
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Active connections
                  </p>
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {dashboardData?.network.pppoeUsers.toLocaleString() || '-'}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Hotspot Sessions
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Active vouchers
                  </p>
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {dashboardData?.network.hotspotSessions.toLocaleString() || '-'}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Bandwidth Usage
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    All time
                  </p>
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {dashboardData?.network.bandwidth || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          System Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* RADIUS Server */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              radiusStatus?.status === 'running'
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <Server className={`w-5 h-5 ${
                radiusStatus?.status === 'running'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                RADIUS Server
              </p>
              <div className="flex items-center gap-2 mt-1">
                {radiusStatus?.status === 'running' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-green-600">Uptime: {radiusStatus.uptime}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs text-red-600">Offline</span>
                  </>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestartRadius}
              disabled={restarting}
              className="h-8"
            >
              {restarting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCw className="h-3 w-3" />
              )}
            </Button>
          </div>

          {/* Database */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              dashboardData?.systemStatus?.database
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <Database className={`w-5 h-5 ${
                dashboardData?.systemStatus?.database
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Database
              </p>
              <div className="flex items-center gap-1 mt-1">
                {dashboardData?.systemStatus?.database ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-green-600">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs text-red-600">Disconnected</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* API */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              dashboardData?.systemStatus?.api
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <Zap className={`w-5 h-5 ${
                dashboardData?.systemStatus?.api
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                API Services
              </p>
              <div className="flex items-center gap-1 mt-1">
                {dashboardData?.systemStatus?.api ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-green-600">Running</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs text-red-600">Down</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
