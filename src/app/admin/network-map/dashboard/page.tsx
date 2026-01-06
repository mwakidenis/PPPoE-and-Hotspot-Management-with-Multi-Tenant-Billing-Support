'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Server,
  Router as RouterIcon,
  Radio,
  Wifi,
  Users,
  RefreshCw,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react';

// Dynamic import map to avoid SSR
const NetworkMapComponent = dynamic(
  () => import('@/components/map/NetworkMapComponent'),
  { ssr: false, loading: () => <div className="h-full w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">Loading map...</div> }
);

// PON Port Colors (16 ports) - Same as management page
const PON_COLORS = [
  { port: 1, color: '#EF4444', name: 'PON 1' },
  { port: 2, color: '#F97316', name: 'PON 2' },
  { port: 3, color: '#F59E0B', name: 'PON 3' },
  { port: 4, color: '#EAB308', name: 'PON 4' },
  { port: 5, color: '#84CC16', name: 'PON 5' },
  { port: 6, color: '#22C55E', name: 'PON 6' },
  { port: 7, color: '#10B981', name: 'PON 7' },
  { port: 8, color: '#14B8A6', name: 'PON 8' },
  { port: 9, color: '#06B6D4', name: 'PON 9' },
  { port: 10, color: '#0EA5E9', name: 'PON 10' },
  { port: 11, color: '#3B82F6', name: 'PON 11' },
  { port: 12, color: '#6366F1', name: 'PON 12' },
  { port: 13, color: '#8B5CF6', name: 'PON 13' },
  { port: 14, color: '#A855F7', name: 'PON 14' },
  { port: 15, color: '#D946EF', name: 'PON 15' },
  { port: 16, color: '#EC4899', name: 'PON 16' },
];

export default function NetworkMapDashboard() {
  const [stats, setStats] = useState({
    servers: 0,
    olts: 0,
    odcs: 0,
    odps: 0,
    customers: 0,
    activeCustomers: 0,
  });

  const [visibleLayers, setVisibleLayers] = useState({
    servers: true,
    olts: true,
    odcs: true,
    odps: true,
    customers: true,
    cables: true,
  });

  const [networkData, setNetworkData] = useState({
    servers: [],
    olts: [],
    odcs: [],
    odps: [],
    customers: [],
    customerAssignments: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNetworkData();
  }, []);

  const loadNetworkData = async () => {
    setLoading(true);
    try {
      const [serversRes, oltsRes, odcsRes, odpsRes, customersRes, assignmentsRes] = await Promise.all([
        fetch('/api/network/servers'),
        fetch('/api/network/olts'),
        fetch('/api/network/odcs'),
        fetch('/api/network/odps'),
        fetch('/api/pppoe/users'), // Existing users API
        fetch('/api/network/customers/assign'),
      ]);

      const servers = await serversRes.json();
      const olts = await oltsRes.json();
      const odcs = await odcsRes.json();
      const odps = await odpsRes.json();
      const customers = await customersRes.json();
      const assignments = await assignmentsRes.json();

      // Filter customers with latitude and longitude
      const customersWithLocation = (customers.users || []).filter(
        (user: any) => user.latitude && user.longitude
      );

      setNetworkData({
        servers: servers.servers || [],
        olts: olts.olts || [],
        odcs: odcs.odcs || [],
        odps: odps.odps || [],
        customers: customersWithLocation,
        customerAssignments: assignments || [],
      });

      setStats({
        servers: servers.servers?.length || 0,
        olts: olts.olts?.length || 0,
        odcs: odcs.odcs?.length || 0,
        odps: odps.odps?.length || 0,
        customers: customers.users?.length || 0,
        activeCustomers:
          customers.users?.filter((u: any) => u.status === 'active').length || 0,
      });
    } catch (error) {
      console.error('Failed to load network data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadNetworkData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const toggleLayer = (layer: keyof typeof visibleLayers) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Network Map</h1>
          <p className="text-gray-500 mt-1">Visualize your network topology</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Servers</p>
                <p className="text-2xl font-bold">{stats.servers}</p>
              </div>
              <Server className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">OLTs</p>
                <p className="text-2xl font-bold">{stats.olts}</p>
              </div>
              <RouterIcon className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">ODCs</p>
                <p className="text-2xl font-bold">{stats.odcs}</p>
              </div>
              <Radio className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">ODPs</p>
                <p className="text-2xl font-bold">{stats.odps}</p>
              </div>
              <Wifi className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Customers</p>
                <p className="text-2xl font-bold">{stats.customers}</p>
              </div>
              <Users className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeCustomers}</p>
              </div>
              <Users className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Layer Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Map Layers
            </CardTitle>
            <CardDescription>Toggle visibility</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-400" />
                Servers
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLayer('servers')}
              >
                {visibleLayers.servers ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <RouterIcon className="h-4 w-4 text-purple-400" />
                OLTs
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLayer('olts')}
              >
                {visibleLayers.olts ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <Radio className="h-4 w-4 text-yellow-400" />
                ODCs
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLayer('odcs')}
              >
                {visibleLayers.odcs ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <Wifi className="h-4 w-4 text-green-400" />
                ODPs
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLayer('odps')}
              >
                {visibleLayers.odps ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-400" />
                Customers
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLayer('customers')}
              >
                {visibleLayers.customers ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </div>

            <hr />

            {/* PON Port Legend */}
            <div>
              <p className="text-sm font-medium mb-2">PON Port Colors</p>
              <div className="space-y-1.5">
                {PON_COLORS.map((pon) => (
                  <div key={pon.port} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: pon.color }}
                    />
                    <span>{pon.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <div className="lg:col-span-3">
          <Card className="h-[600px]">
            <CardContent className="p-0 h-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">Loading network data...</p>
                  </div>
                </div>
              ) : (
                <NetworkMapComponent
                  networkData={networkData}
                  visibleLayers={visibleLayers}
                  ponColors={PON_COLORS}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
