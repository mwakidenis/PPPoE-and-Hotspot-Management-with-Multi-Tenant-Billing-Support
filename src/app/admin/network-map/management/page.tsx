'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Server,
  Router as RouterIcon,
  Radio,
  Wifi,
  Users,
  Plus,
  Edit,
  Trash2,
  MapPin,
  RefreshCw,
  Settings,
} from 'lucide-react';
import Swal from 'sweetalert2';
import MapPicker from '@/components/MapPicker';
import AssignCustomerDialog from '@/components/network/AssignCustomerDialog';
import EditAssignmentDialog from '@/components/network/EditAssignmentDialog';

type TabType = 'servers' | 'olts' | 'odcs' | 'odps' | 'customers' | 'settings';

// PON Port Colors (16 ports)
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

export default function NetworkMapManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('servers');
  const [servers, setServers] = useState<any[]>([]);
  const [olts, setOlts] = useState<any[]>([]);
  const [odcs, setOdcs] = useState<any[]>([]);
  const [odps, setOdps] = useState<any[]>([]);
  const [routers, setRouters] = useState<any[]>([]);
  const [availableRouters, setAvailableRouters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedRouter, setSelectedRouter] = useState<any>(null);
  const [mapSettings, setMapSettings] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [customerAssignments, setCustomerAssignments] = useState<any[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    latitude: '',
    longitude: '',
    status: 'active',
    routerId: '',
  });

  // OLT form state
  const [oltFormData, setOltFormData] = useState({
    name: '',
    ipAddress: '',
    latitude: '',
    longitude: '',
    status: 'active',
    routerIds: [] as string[], // Multi-uplink routers
    ponPorts: '8',
    followRoad: false,
  });

  // ODC form state
  const [odcFormData, setOdcFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    oltId: '',
    ponPort: 1,
    portCount: 8,
    followRoad: false,
  });

  // ODP form state
  const [odpFormData, setOdpFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    odcId: '',
    parentOdpId: '',
    portCount: 8,
    followRoad: false,
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    osrmApiUrl: '',
    followRoad: false,
    defaultLat: '',
    defaultLon: '',
    defaultZoom: '',
  });

  useEffect(() => {
    if (activeTab === 'servers') {
      loadRouters();
      loadServers();
    } else if (activeTab === 'olts') {
      loadRouters(); // Load routers for multi-select
      loadOlts();
    } else if (activeTab === 'odcs') {
      loadOlts(); // Load OLTs for dropdown
      loadOdcs();
      loadOdps(); // Load ODPs for accurate counting
    } else if (activeTab === 'odps') {
      loadOdcs(); // Load ODCs for dropdown
      loadOdps();
    } else if (activeTab === 'customers') {
      loadCustomerAssignments();
    } else if (activeTab === 'settings') {
      loadSettings();
    }
  }, [activeTab]);

  const loadRouters = async () => {
    setLoading(true);
    try {
      const [routersRes, serversRes] = await Promise.all([
        fetch('/api/network/routers'),
        fetch('/api/network/servers'),
      ]);

      const routersData = await routersRes.json();
      const serversData = await serversRes.json();

      const allRouters = routersData.routers || [];
      const existingServers = serversData.servers || [];

      // Find routers that don't have a network server entry yet
      const routerIdsWithServers = new Set(
        existingServers.map((s: any) => s.routerId).filter(Boolean)
      );
      const available = allRouters.filter((r: any) => !routerIdsWithServers.has(r.id));

      setRouters(allRouters);
      setServers(existingServers);
      setAvailableRouters(available);
    } catch (error) {
      console.error('Failed to load routers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServers = async () => {
    try {
      const res = await fetch('/api/network/servers');
      const data = await res.json();
      setServers(data.servers || []);
    } catch (error) {
      console.error('Failed to load servers:', error);
    }
  };

  const loadOlts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/network/olts');
      const data = await res.json();
      setOlts(data.olts || []);
    } catch (error) {
      console.error('Failed to load OLTs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOdcs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/network/odcs');
      const data = await res.json();
      setOdcs(data.odcs || []);
    } catch (error) {
      console.error('Failed to load ODCs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOdps = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/network/odps');
      const data = await res.json();
      setOdps(data.odps || []);
    } catch (error) {
      console.error('Failed to load ODPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRouter = async (router: any) => {
    setSelectedRouter(router);
    setLoading(true);

    // Check router status
    let status = 'inactive';
    try {
      const res = await fetch('/api/network/routers/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routerIds: [router.id] }),
      });
      const data = await res.json();
      if (data.statusMap && data.statusMap[router.id]?.online) {
        status = 'active';
      }
    } catch (error) {
      console.error('Failed to check router status:', error);
    }

    setFormData({
      name: router.name,
      ipAddress: router.ipAddress,
      latitude: '',
      longitude: '',
      status,
      routerId: router.id,
    });
    setLoading(false);
    setShowMapPicker(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.latitude || !formData.longitude) {
      Swal.fire('Error', 'Please select location on map', 'error');
      return;
    }

    setLoading(true);
    try {
      const url = '/api/network/servers';
      const method = editingItem ? 'PUT' : 'POST';
      const payload = editingItem ? { ...formData, id: editingItem.id } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Success', `Server location ${editingItem ? 'updated' : 'set'} successfully`, 'success');
        setShowForm(false);
        setEditingItem(null);
        setSelectedRouter(null);
        resetForm();
        loadRouters();
      } else {
        Swal.fire('Error', data.error || 'Failed to save server', 'error');
      }
    } catch (error) {
      console.error('Save server error:', error);
      Swal.fire('Error', 'Failed to save server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      ipAddress: item.ipAddress,
      latitude: item.latitude.toString(),
      longitude: item.longitude.toString(),
      status: item.status,
      routerId: item.routerId || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Delete Server?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete',
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/network/servers?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Deleted!', 'Server deleted successfully', 'success');
        loadServers();
      } else {
        Swal.fire('Error', data.error || 'Failed to delete server', 'error');
      }
    } catch (error) {
      console.error('Delete server error:', error);
      Swal.fire('Error', 'Failed to delete server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      ipAddress: '',
      latitude: '',
      longitude: '',
      status: 'active',
      routerId: '',
    });
  };

  const handleMapSelect = (lat: number, lng: number) => {
    if (activeTab === 'olts') {
      setOltFormData({
        ...oltFormData,
        latitude: lat.toString(),
        longitude: lng.toString(),
      });
    } else if (activeTab === 'odcs') {
      setOdcFormData({
        ...odcFormData,
        latitude: lat.toString(),
        longitude: lng.toString(),
      });
    } else if (activeTab === 'odps') {
      setOdpFormData({
        ...odpFormData,
        latitude: lat.toString(),
        longitude: lng.toString(),
      });
    } else {
      setFormData({
        ...formData,
        latitude: lat.toString(),
        longitude: lng.toString(),
      });
    }
    setShowMapPicker(false);
    setShowForm(true);
  };

  const handleOltSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oltFormData.latitude || !oltFormData.longitude) {
      Swal.fire('Error', 'Please select location on map', 'error');
      return;
    }

    setLoading(true);
    try {
      const url = '/api/network/olts';
      const method = editingItem ? 'PUT' : 'POST';
      const payload = editingItem ? { ...oltFormData, id: editingItem.id } : oltFormData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Success', `OLT ${editingItem ? 'updated' : 'created'} successfully`, 'success');
        setShowForm(false);
        setEditingItem(null);
        resetOltForm();
        loadOlts();
      } else {
        Swal.fire('Error', data.error || 'Failed to save OLT', 'error');
      }
    } catch (error) {
      console.error('Save OLT error:', error);
      Swal.fire('Error', 'Failed to save OLT', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditOlt = (item: any) => {
    setEditingItem(item);
    // Extract router IDs from routers relationship
    const routerIds = item.routers?.map((r: any) => r.routerId) || [];
    setOltFormData({
      name: item.name,
      ipAddress: item.ipAddress,
      latitude: item.latitude.toString(),
      longitude: item.longitude.toString(),
      status: item.status,
      routerIds,
      ponPorts: '8', // Default, could be stored in DB later
      followRoad: item.followRoad || false,
    });
    setShowForm(true);
  };

  const handleDeleteOlt = async (id: string) => {
    const result = await Swal.fire({
      title: 'Delete OLT?',
      text: 'This will also delete all associated ODPs. This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete',
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/network/olts?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Deleted!', 'OLT deleted successfully', 'success');
        loadOlts();
      } else {
        Swal.fire('Error', data.error || 'Failed to delete OLT', 'error');
      }
    } catch (error) {
      console.error('Delete OLT error:', error);
      Swal.fire('Error', 'Failed to delete OLT', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetOltForm = () => {
    setOltFormData({
      name: '',
      ipAddress: '',
      latitude: '',
      longitude: '',
      status: 'active',
      routerIds: [],
      ponPorts: '8',
      followRoad: false,
    });
  };

  // ODC Functions
  const handleOdcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!odcFormData.latitude || !odcFormData.longitude) {
      Swal.fire('Error', 'Please select location on map', 'error');
      return;
    }

    setLoading(true);
    try {
      const url = '/api/network/odcs';
      const method = editingItem ? 'PUT' : 'POST';
      const payload = editingItem ? { ...odcFormData, id: editingItem.id } : odcFormData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Success', `ODC ${editingItem ? 'updated' : 'created'} successfully`, 'success');
        setShowForm(false);
        setEditingItem(null);
        resetOdcForm();
        loadOdcs();
      } else {
        Swal.fire('Error', data.error || 'Failed to save ODC', 'error');
      }
    } catch (error) {
      console.error('Save ODC error:', error);
      Swal.fire('Error', 'Failed to save ODC', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditOdc = (item: any) => {
    setEditingItem(item);
    setOdcFormData({
      name: item.name,
      latitude: item.latitude.toString(),
      longitude: item.longitude.toString(),
      oltId: item.oltId || '',
      ponPort: item.ponPort || 1,
      portCount: item.portCount || 8,
      followRoad: item.followRoad || false,
    });
    setShowForm(true);
  };

  const handleDeleteOdc = async (id: string) => {
    const result = await Swal.fire({
      title: 'Delete ODC?',
      text: 'This will also delete all associated ODPs. This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete',
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/network/odcs?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Deleted!', 'ODC deleted successfully', 'success');
        loadOdcs();
      } else {
        Swal.fire('Error', data.error || 'Failed to delete ODC', 'error');
      }
    } catch (error) {
      console.error('Delete ODC error:', error);
      Swal.fire('Error', 'Failed to delete ODC', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetOdcForm = () => {
    setOdcFormData({
      name: '',
      latitude: '',
      longitude: '',
      oltId: '',
      ponPort: 1,
      portCount: 8,
      followRoad: false,
    });
  };

  // ODP Functions
  const handleOdpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!odpFormData.latitude || !odpFormData.longitude) {
      Swal.fire('Error', 'Please select location on map', 'error');
      return;
    }

    if (!odpFormData.odcId && !odpFormData.parentOdpId) {
      Swal.fire('Error', 'Please select either ODC or Parent ODP', 'error');
      return;
    }

    setLoading(true);
    try {
      // Get PON port from ODC or parent ODP
      let ponPort = 1;
      let oltId = '';
      
      if (odpFormData.odcId) {
        const odc = odcs.find((o: any) => o.id === odpFormData.odcId);
        if (odc) {
          ponPort = odc.ponPort;
          oltId = odc.oltId;
        }
      } else if (odpFormData.parentOdpId) {
        const parentOdp = odps.find((o: any) => o.id === odpFormData.parentOdpId);
        if (parentOdp) {
          ponPort = parentOdp.ponPort;
          oltId = parentOdp.oltId;
        }
      }

      const url = '/api/network/odps';
      const method = editingItem ? 'PUT' : 'POST';
      const payload = editingItem
        ? { ...odpFormData, id: editingItem.id, ponPort, oltId }
        : { ...odpFormData, ponPort, oltId };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Success', `ODP ${editingItem ? 'updated' : 'created'} successfully`, 'success');
        setShowForm(false);
        setEditingItem(null);
        resetOdpForm();
        loadOdps();
      } else {
        Swal.fire('Error', data.error || 'Failed to save ODP', 'error');
      }
    } catch (error) {
      console.error('Save ODP error:', error);
      Swal.fire('Error', 'Failed to save ODP', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditOdp = (item: any) => {
    setEditingItem(item);
    setOdpFormData({
      name: item.name,
      latitude: item.latitude.toString(),
      longitude: item.longitude.toString(),
      odcId: item.odcId || '',
      parentOdpId: item.parentOdpId || '',
      portCount: item.portCount || 8,
      followRoad: item.followRoad || false,
    });
    setShowForm(true);
  };

  const handleDeleteOdp = async (id: string) => {
    const result = await Swal.fire({
      title: 'Delete ODP?',
      text: 'This will also delete all child ODPs. This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete',
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/network/odps?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Deleted!', 'ODP deleted successfully', 'success');
        loadOdps();
      } else {
        Swal.fire('Error', data.error || 'Failed to delete ODP', 'error');
      }
    } catch (error) {
      console.error('Delete ODP error:', error);
      Swal.fire('Error', 'Failed to delete ODP', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetOdpForm = () => {
    setOdpFormData({
      name: '',
      latitude: '',
      longitude: '',
      odcId: '',
      parentOdpId: '',
      portCount: 8,
      followRoad: false,
    });
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/network/map-settings');
      const data = await res.json();
      if (data.success) {
        setMapSettings(data.settings);
        setSettingsForm({
          osrmApiUrl: data.settings.osrmApiUrl,
          followRoad: data.settings.followRoad || false,
          defaultLat: data.settings.defaultLat.toString(),
          defaultLon: data.settings.defaultLon.toString(),
          defaultZoom: data.settings.defaultZoom.toString(),
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);

    try {
      const res = await fetch('/api/network/map-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Success', 'Settings saved successfully', 'success');
        setMapSettings(data.settings);
      } else {
        Swal.fire('Error', data.error || 'Failed to save settings', 'error');
      }
    } catch (error) {
      console.error('Save settings error:', error);
      Swal.fire('Error', 'Failed to save settings', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const testOsrmConnection = async () => {
    if (!settingsForm.osrmApiUrl) {
      Swal.fire('Error', 'Please enter OSRM API URL', 'error');
      return;
    }

    setSettingsLoading(true);
    try {
      const res = await fetch('/api/network/map-settings/test-osrm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ osrmApiUrl: settingsForm.osrmApiUrl }),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Connection Successful!',
          html: `
            <p>${data.message}</p>
            <p class="text-sm text-gray-600 mt-2">
              Routes: ${data.details?.routes || 0} | 
              Waypoints: ${data.details?.waypoints || 0}
            </p>
          `,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Connection Failed',
          html: `
            <p>${data.error}</p>
            ${data.hint ? `<p class="text-sm text-gray-600 mt-2">${data.hint}</p>` : ''}
          `,
        });
      }
    } catch (error: any) {
      console.error('OSRM test error:', error);
      Swal.fire('Error', `Connection failed: ${error.message}`, 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadCustomerAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/network/customers/assign');
      const data = await res.json();
      setCustomerAssignments(data || []);
    } catch (error) {
      console.error('Failed to load customer assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    const result = await Swal.fire({
      title: 'Delete Assignment?',
      text: 'This will unassign the customer from the ODP port.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/network/customers/assign?id=${id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          Swal.fire('Deleted!', 'Customer assignment has been removed.', 'success');
          loadCustomerAssignments();
        } else {
          throw new Error('Failed to delete');
        }
      } catch (error) {
        Swal.fire('Error', 'Failed to delete assignment', 'error');
      }
    }
  };

  const tabs = [
    { id: 'servers' as TabType, label: 'Servers', icon: Server, count: servers.length },
    { id: 'olts' as TabType, label: 'OLT', icon: RouterIcon, count: olts.length },
    { id: 'odcs' as TabType, label: 'ODC', icon: Radio, count: odcs.length },
    { id: 'odps' as TabType, label: 'ODP', icon: Wifi, count: odps.length },
    { id: 'customers' as TabType, label: 'Customers', icon: Users, count: customerAssignments.length },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings, count: null },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Network Management</h1>
          <p className="text-gray-500 mt-1">
            {activeTab === 'customers'
              ? 'Update GPS locations for existing customers'
              : 'Manage network infrastructure locations'}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'customers' && (
            <Button onClick={() => setShowAssignDialog(true)}>
              <Users className="h-4 w-4 mr-2" />
              Assign Customer to ODP
            </Button>
          )}
          <Button
            onClick={() => {
              if (activeTab === 'customers') loadCustomerAssignments();
              else loadServers();
            }}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
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

      {/* Content */}
      {activeTab === 'servers' && (
        <div className="space-y-6">
          {/* Available Routers */}
          {!showForm && availableRouters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Available Routers</CardTitle>
                <CardDescription>
                  Select a router to set its location on the map
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableRouters.map((router) => (
                    <div
                      key={router.id}
                      className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => handleSelectRouter(router)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{router.name}</h3>
                          <p className="text-sm text-gray-600 font-mono mt-1">{router.ipAddress}</p>
                        </div>
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                      <Button size="sm" className="w-full mt-3">
                        <MapPin className="h-3 w-3 mr-1" />
                        Set Location
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form - Confirm Location */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingItem ? 'Edit Server Location' : 'Confirm Server Location'}</CardTitle>
                <CardDescription>
                  {editingItem ? 'Update' : 'Confirm'} location for {formData.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Server Name</Label>
                      <Input value={formData.name} disabled />
                    </div>

                    <div>
                      <Label>IP Address</Label>
                      <Input value={formData.ipAddress} disabled />
                    </div>

                    <div>
                      <Label htmlFor="latitude">Latitude *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          value={formData.latitude}
                          onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                          placeholder="e.g. -7.071285"
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowMapPicker(true)}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="longitude">Longitude *</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        value={formData.longitude}
                        onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                        placeholder="e.g. 108.044772"
                        required
                      />
                    </div>

                    <div>
                      <Label>Router Status</Label>
                      <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            formData.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {formData.status === 'active' ? '● Online' : '● Offline'}
                        </span>
                        <span className="text-xs text-gray-500">(Auto-detected)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setEditingItem(null);
                        setSelectedRouter(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : editingItem ? 'Update Location' : 'Save Location'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        IP Address
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Router
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        OLTs
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading...
                        </td>
                      </tr>
                    ) : servers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No servers found. Add your first server above.
                        </td>
                      </tr>
                    ) : (
                      servers.map((server) => (
                        <tr key={server.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{server.name}</td>
                          <td className="px-4 py-3 font-mono text-sm">{server.ipAddress}</td>
                          <td className="px-4 py-3 text-sm">
                            {server.latitude.toFixed(6)}, {server.longitude.toFixed(6)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {server.router?.name || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                server.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : server.status === 'maintenance'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {server.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{server._count?.olts || 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(server)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(server.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* OLT Tab */}
      {activeTab === 'olts' && (
        <div className="space-y-6">
          {/* Add Button */}
          {!showForm && (
            <Button
              onClick={() => {
                setShowForm(true);
                setEditingItem(null);
                resetOltForm();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add OLT
            </Button>
          )}

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingItem ? 'Edit OLT' : 'Add New OLT'}</CardTitle>
                <CardDescription>
                  {editingItem ? 'Update OLT information' : 'Add a new OLT to the network'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOltSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="oltName">OLT Name *</Label>
                      <Input
                        id="oltName"
                        value={oltFormData.name}
                        onChange={(e) => setOltFormData({ ...oltFormData, name: e.target.value })}
                        placeholder="e.g. OLT-TSM-01"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="oltIpAddress">IP Address *</Label>
                      <Input
                        id="oltIpAddress"
                        value={oltFormData.ipAddress}
                        onChange={(e) => setOltFormData({ ...oltFormData, ipAddress: e.target.value })}
                        placeholder="e.g. 192.168.1.10"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Multi-Uplink Routers (NAS)</Label>
                      <p className="text-xs text-gray-500 mb-2">Select one or more routers for redundancy. Order = priority (top = primary)</p>
                      <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                        {routers.length === 0 ? (
                          <p className="text-sm text-gray-500">No routers available</p>
                        ) : (
                          routers.map((router) => (
                            <label key={router.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                              <input
                                type="checkbox"
                                checked={oltFormData.routerIds.includes(router.id)}
                                onChange={(e) => {
                                  const newRouterIds = e.target.checked
                                    ? [...oltFormData.routerIds, router.id]
                                    : oltFormData.routerIds.filter(id => id !== router.id);
                                  setOltFormData({ ...oltFormData, routerIds: newRouterIds });
                                }}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{router.name}</div>
                                <div className="text-xs text-gray-500">{router.nasname} - {router.ipAddress}</div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                      {oltFormData.routerIds.length > 0 && (
                        <p className="text-xs text-blue-600 mt-1">
                          {oltFormData.routerIds.length} router(s) selected
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="ponPorts">PON Ports</Label>
                      <select
                        id="ponPorts"
                        value={oltFormData.ponPorts}
                        onChange={(e) => setOltFormData({ ...oltFormData, ponPorts: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {Array.from({ length: 16 }, (_, i) => i + 1).map((num) => {
                          const ponColor = PON_COLORS.find(p => p.port === num);
                          return (
                            <option key={num} value={num}>
                              {num} Port{num > 1 ? 's' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {PON_COLORS.slice(0, parseInt(oltFormData.ponPorts)).map((pon) => (
                          <div
                            key={pon.port}
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: pon.color }}
                            title={pon.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="oltLatitude">Latitude *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="oltLatitude"
                          type="number"
                          step="any"
                          value={oltFormData.latitude}
                          onChange={(e) => setOltFormData({ ...oltFormData, latitude: e.target.value })}
                          placeholder="e.g. -7.071285"
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowMapPicker(true)}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="oltLongitude">Longitude *</Label>
                      <Input
                        id="oltLongitude"
                        type="number"
                        step="any"
                        value={oltFormData.longitude}
                        onChange={(e) => setOltFormData({ ...oltFormData, longitude: e.target.value })}
                        placeholder="e.g. 108.044772"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <input
                          type="checkbox"
                          id="oltFollowRoad"
                          checked={oltFormData.followRoad}
                          onChange={(e) => setOltFormData({ ...oltFormData, followRoad: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <Label htmlFor="oltFollowRoad" className="cursor-pointer font-medium">
                            Follow Road
                          </Label>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Use OSRM routing to follow roads when connecting to server. If disabled, will use straight line.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setEditingItem(null);
                        resetOltForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        IP Address
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Uplink Routers
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        ODPs
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading...
                        </td>
                      </tr>
                    ) : olts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No OLTs found. Add your first OLT above.
                        </td>
                      </tr>
                    ) : (
                      olts.map((olt) => (
                        <tr key={olt.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{olt.name}</td>
                          <td className="px-4 py-3 font-mono text-sm">{olt.ipAddress}</td>
                          <td className="px-4 py-3 text-sm">
                            {olt.latitude.toFixed(6)}, {olt.longitude.toFixed(6)}
                          </td>
                          <td className="px-4 py-3">
                            {olt.routers && olt.routers.length > 0 ? (
                              <div className="space-y-1">
                                {olt.routers.map((r: any, idx: number) => (
                                  <div key={r.id} className="text-xs">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                      {idx === 0 && '★'} {r.router.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">No routers</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                olt.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {olt.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{olt._count?.odps || 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditOlt(olt)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteOlt(olt.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ODC Tab */}
      {activeTab === 'odcs' && (
        <div className="space-y-6">
          {/* Add Button */}
          {!showForm && (
            <Button
              onClick={() => {
                setShowForm(true);
                setEditingItem(null);
                resetOdcForm();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add ODC
            </Button>
          )}

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingItem ? 'Edit ODC' : 'Add New ODC'}</CardTitle>
                <CardDescription>
                  {editingItem ? 'Update ODC information' : 'Add a new ODC (Optical Distribution Cabinet) to the network'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOdcSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="odcName">ODC Name *</Label>
                      <Input
                        id="odcName"
                        value={odcFormData.name}
                        onChange={(e) => setOdcFormData({ ...odcFormData, name: e.target.value })}
                        placeholder="e.g. ODC-01"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="odcOltId">Assign to OLT *</Label>
                      <select
                        id="odcOltId"
                        value={odcFormData.oltId}
                        onChange={(e) => setOdcFormData({ ...odcFormData, oltId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required
                      >
                        <option value="">Select OLT</option>
                        {olts.map((olt) => (
                          <option key={olt.id} value={olt.id}>
                            {olt.name} ({olt.ipAddress})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="odcPonPort">PON Port *</Label>
                      <select
                        id="odcPonPort"
                        value={odcFormData.ponPort}
                        onChange={(e) => setOdcFormData({ ...odcFormData, ponPort: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required
                      >
                        {PON_COLORS.map((pon) => (
                          <option key={pon.port} value={pon.port}>
                            PON {pon.port}
                          </option>
                        ))}
                      </select>
                      {odcFormData.ponPort && (
                        <div className="mt-2 flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: PON_COLORS[odcFormData.ponPort - 1]?.color }}
                          />
                          <span className="text-sm text-gray-600">
                            {PON_COLORS[odcFormData.ponPort - 1]?.name}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="odcPortCount">Port Count</Label>
                      <select
                        id="odcPortCount"
                        value={odcFormData.portCount}
                        onChange={(e) => setOdcFormData({ ...odcFormData, portCount: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {[4, 8, 12, 16, 24, 32].map((count) => (
                          <option key={count} value={count}>
                            {count} Ports
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="odcLatitude">Latitude *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="odcLatitude"
                          type="number"
                          step="any"
                          value={odcFormData.latitude}
                          onChange={(e) => setOdcFormData({ ...odcFormData, latitude: e.target.value })}
                          placeholder="e.g. -7.071285"
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowMapPicker(true)}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="odcLongitude">Longitude *</Label>
                      <Input
                        id="odcLongitude"
                        type="number"
                        step="any"
                        value={odcFormData.longitude}
                        onChange={(e) => setOdcFormData({ ...odcFormData, longitude: e.target.value })}
                        placeholder="e.g. 108.044772"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <input
                          type="checkbox"
                          id="odcFollowRoad"
                          checked={odcFormData.followRoad}
                          onChange={(e) => setOdcFormData({ ...odcFormData, followRoad: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <Label htmlFor="odcFollowRoad" className="cursor-pointer font-medium">
                            Follow Road
                          </Label>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Use OSRM routing to follow roads when connecting to OLT. If disabled, will use straight line.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setEditingItem(null);
                        resetOdcForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        OLT
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        PON Port
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ports
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        ODPs
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading...
                        </td>
                      </tr>
                    ) : odcs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No ODCs found. Add your first ODC above.
                        </td>
                      </tr>
                    ) : (
                      odcs.map((odc) => {
                        const ponColor = PON_COLORS.find((p) => p.port === odc.ponPort);
                        // Count all ODPs connected to this ODC (direct + cascaded)
                        const directOdps = odps.filter((o: any) => o.odcId === odc.id);
                        const getTotalOdps = (parentOdpIds: string[]): number => {
                          const childOdps = odps.filter((o: any) => parentOdpIds.includes(o.parentOdpId));
                          if (childOdps.length === 0) return 0;
                          return childOdps.length + getTotalOdps(childOdps.map((o: any) => o.id));
                        };
                        const totalOdps = directOdps.length + getTotalOdps(directOdps.map((o: any) => o.id));
                        
                        return (
                          <tr key={odc.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{odc.name}</td>
                            <td className="px-4 py-3 text-sm">
                              {odc.olt?.name || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded"
                                  style={{ backgroundColor: ponColor?.color }}
                                />
                                <span className="text-sm">PON {odc.ponPort}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {odc.latitude.toFixed(6)}, {odc.longitude.toFixed(6)}
                            </td>
                            <td className="px-4 py-3 text-sm">{odc.portCount} ports</td>
                            <td className="px-4 py-3 text-sm">{totalOdps}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditOdc(odc)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteOdc(odc.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ODP Tab */}
      {activeTab === 'odps' && (
        <div className="space-y-6">
          {/* Add Button */}
          {!showForm && (
            <Button
              onClick={() => {
                setShowForm(true);
                setEditingItem(null);
                resetOdpForm();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add ODP
            </Button>
          )}

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingItem ? 'Edit ODP' : 'Add New ODP'}</CardTitle>
                <CardDescription>
                  {editingItem ? 'Update ODP information' : 'Add a new ODP (Optical Distribution Point) to the network'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOdpSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="odpName">ODP Name *</Label>
                      <Input
                        id="odpName"
                        value={odpFormData.name}
                        onChange={(e) => setOdpFormData({ ...odpFormData, name: e.target.value })}
                        placeholder="e.g. ODP-01"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="odpOdcId">Assign to ODC</Label>
                      <select
                        id="odpOdcId"
                        value={odpFormData.odcId}
                        onChange={(e) => {
                          setOdpFormData({ 
                            ...odpFormData, 
                            odcId: e.target.value,
                            parentOdpId: e.target.value ? '' : odpFormData.parentOdpId // Clear parent if ODC selected
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select ODC (optional)</option>
                        {odcs.map((odc) => {
                          const ponColor = PON_COLORS.find((p) => p.port === odc.ponPort);
                          return (
                            <option key={odc.id} value={odc.id}>
                              {odc.name} - PON {odc.ponPort} ({odc.olt?.name})
                            </option>
                          );
                        })}
                      </select>
                      {odpFormData.odcId && (() => {
                        const selectedOdc = odcs.find((o) => o.id === odpFormData.odcId);
                        const ponColor = PON_COLORS.find((p) => p.port === selectedOdc?.ponPort);
                        return selectedOdc ? (
                          <div className="mt-2 flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded"
                              style={{ backgroundColor: ponColor?.color }}
                            />
                            <span className="text-sm text-gray-600">
                              {ponColor?.name}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    <div>
                      <Label htmlFor="odpParentOdpId">OR Cascade from Parent ODP</Label>
                      <select
                        id="odpParentOdpId"
                        value={odpFormData.parentOdpId}
                        onChange={(e) => {
                          setOdpFormData({ 
                            ...odpFormData, 
                            parentOdpId: e.target.value,
                            odcId: e.target.value ? '' : odpFormData.odcId // Clear ODC if parent selected
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        disabled={!!odpFormData.odcId}
                      >
                        <option value="">Select Parent ODP (optional)</option>
                        {odps.filter((o) => o.id !== editingItem?.id).map((odp) => {
                          const ponColor = PON_COLORS.find((p) => p.port === odp.ponPort);
                          return (
                            <option key={odp.id} value={odp.id}>
                              {odp.name} - PON {odp.ponPort}
                            </option>
                          );
                        })}
                      </select>
                      {odpFormData.parentOdpId && (() => {
                        const selectedParent = odps.find((o) => o.id === odpFormData.parentOdpId);
                        const ponColor = PON_COLORS.find((p) => p.port === selectedParent?.ponPort);
                        return selectedParent ? (
                          <div className="mt-2 flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded"
                              style={{ backgroundColor: ponColor?.color }}
                            />
                            <span className="text-sm text-gray-600">
                              {ponColor?.name}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    <div>
                      <Label htmlFor="odpPortCount">Port Count</Label>
                      <select
                        id="odpPortCount"
                        value={odpFormData.portCount}
                        onChange={(e) => setOdpFormData({ ...odpFormData, portCount: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {Array.from({ length: 16 }, (_, i) => i + 1).map((num) => (
                          <option key={num} value={num}>
                            {num} Port{num > 1 ? 's' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">
                        💡 Select either ODC (first ODP) or Parent ODP (cascade ODP). PON color will inherit automatically.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="odpLatitude">Latitude *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="odpLatitude"
                          type="number"
                          step="any"
                          value={odpFormData.latitude}
                          onChange={(e) => setOdpFormData({ ...odpFormData, latitude: e.target.value })}
                          placeholder="e.g. -7.071285"
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowMapPicker(true)}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="odpLongitude">Longitude *</Label>
                      <Input
                        id="odpLongitude"
                        type="number"
                        step="any"
                        value={odpFormData.longitude}
                        onChange={(e) => setOdpFormData({ ...odpFormData, longitude: e.target.value })}
                        placeholder="e.g. 108.044772"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <input
                          type="checkbox"
                          id="odpFollowRoad"
                          checked={odpFormData.followRoad}
                          onChange={(e) => setOdpFormData({ ...odpFormData, followRoad: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <Label htmlFor="odpFollowRoad" className="cursor-pointer font-medium">
                            Follow Road
                          </Label>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Use OSRM routing to follow roads when connecting. If disabled, will use straight line.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setEditingItem(null);
                        resetOdpForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Parent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        PON Port
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ports
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading...
                        </td>
                      </tr>
                    ) : odps.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No ODPs found. Add your first ODP above.
                        </td>
                      </tr>
                    ) : (
                      odps.map((odp) => {
                        const ponColor = PON_COLORS.find((p) => p.port === odp.ponPort);
                        return (
                          <tr key={odp.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{odp.name}</td>
                            <td className="px-4 py-3 text-sm">
                              {odp.odc?.name || odp.parentOdp?.name || '-'}
                              {odp.odc && <span className="text-xs text-gray-500"> (ODC)</span>}
                              {odp.parentOdp && <span className="text-xs text-gray-500"> (ODP)</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded"
                                  style={{ backgroundColor: ponColor?.color }}
                                />
                                <span className="text-sm">PON {odp.ponPort}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{odp.portCount || 8} ports</td>
                            <td className="px-4 py-3 text-sm">
                              {odp.latitude.toFixed(6)}, {odp.longitude.toFixed(6)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  odp.status === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {odp.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditOdp(odp)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteOdp(odp.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Map Settings</CardTitle>
            <CardDescription>
              Configure map routing and default display settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* OSRM Settings */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">OSRM Routing Service</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Configure the OSRM (Open Source Routing Machine) server for route calculations.
                    You can use the public server or your own self-hosted instance.
                  </p>
                </div>

                <div>
                  <Label htmlFor="osrmApiUrl">OSRM API URL *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="osrmApiUrl"
                      value={settingsForm.osrmApiUrl}
                      onChange={(e) => setSettingsForm({ ...settingsForm, osrmApiUrl: e.target.value })}
                      placeholder="http://router.project-osrm.org"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={testOsrmConnection}
                      disabled={settingsLoading}
                    >
                      Test
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Public: <code className="bg-gray-100 px-1 rounded">http://router.project-osrm.org</code>
                    {' | '}
                    Local: <code className="bg-gray-100 px-1 rounded">http://localhost:5000</code>
                  </p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <input
                    type="checkbox"
                    id="followRoad"
                    checked={settingsForm.followRoad}
                    onChange={(e) => setSettingsForm({ ...settingsForm, followRoad: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div className="flex-1">
                    <Label htmlFor="followRoad" className="cursor-pointer font-medium">
                      Enable Follow Road
                    </Label>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Use OSRM routing to follow roads. If disabled, connections will use straight lines.
                    </p>
                  </div>
                </div>
              </div>

              <hr />

              {/* Default Map View */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Default Map View</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="defaultLat">Default Latitude</Label>
                    <Input
                      id="defaultLat"
                      type="number"
                      step="any"
                      value={settingsForm.defaultLat}
                      onChange={(e) => setSettingsForm({ ...settingsForm, defaultLat: e.target.value })}
                      placeholder="-7.071273611475302"
                    />
                  </div>

                  <div>
                    <Label htmlFor="defaultLon">Default Longitude</Label>
                    <Input
                      id="defaultLon"
                      type="number"
                      step="any"
                      value={settingsForm.defaultLon}
                      onChange={(e) => setSettingsForm({ ...settingsForm, defaultLon: e.target.value })}
                      placeholder="108.04475042198051"
                    />
                  </div>

                  <div>
                    <Label htmlFor="defaultZoom">Default Zoom Level</Label>
                    <Input
                      id="defaultZoom"
                      type="number"
                      min="1"
                      max="19"
                      value={settingsForm.defaultZoom}
                      onChange={(e) => setSettingsForm({ ...settingsForm, defaultZoom: e.target.value })}
                      placeholder="13"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={settingsLoading}>
                  {settingsLoading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Customer Tab */}
      {activeTab === 'customers' && (
        <Card>
          <CardHeader>
            <CardTitle>Customer ODP Assignments</CardTitle>
            <CardDescription>
              Manage customer assignments to ODP ports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 font-semibold">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold">Username</th>
                    <th className="text-left px-4 py-3 font-semibold">Profile</th>
                    <th className="text-left px-4 py-3 font-semibold">ODP</th>
                    <th className="text-left px-4 py-3 font-semibold">Port</th>
                    <th className="text-left px-4 py-3 font-semibold">Distance</th>
                    <th className="text-left px-4 py-3 font-semibold">OLT</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : customerAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        <Users className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-600 dark:text-gray-400">
                          No unassigned customers found
                        </p>
                        <p className="text-sm text-gray-500">
                          All customers with GPS are already assigned to ODPs
                        </p>
                      </td>
                    </tr>
                  ) : (
                    customerAssignments.map((assignment) => (
                      <tr key={assignment.id} className="hover:bg-gray-50 border-b">
                        <td className="px-4 py-3 font-medium">{assignment.customer.name}</td>
                        <td className="px-4 py-3 text-sm font-mono">{assignment.customer.username}</td>
                        <td className="px-4 py-3 text-sm">
                          {assignment.customer.profile?.name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{assignment.odp.name}</span>
                            <span className="text-xs text-gray-500">
                              {assignment.odp.odc?.name || 'Direct'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            Port {assignment.portNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {assignment.distance ? `${assignment.distance.toFixed(2)} km` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">{assignment.odp.olt?.name || '-'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              assignment.customer.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {assignment.customer.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingAssignment(assignment)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other tabs placeholder */}
      {!['servers', 'olts', 'odcs', 'odps', 'customers', 'settings'].includes(activeTab) && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <p className="text-lg font-medium mb-2">Coming Soon</p>
            <p className="text-sm">
              {activeTab.toUpperCase()} management will be available soon.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Map Picker */}
      <MapPicker
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onSelect={handleMapSelect}
        initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
        initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
      />

      {/* Assign Customer Dialog */}
      <AssignCustomerDialog
        isOpen={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        onSuccess={() => {
          loadCustomerAssignments();
          Swal.fire('Success', 'Customer assigned successfully!', 'success');
        }}
      />

      {/* Edit Assignment Dialog */}
      <EditAssignmentDialog
        isOpen={!!editingAssignment}
        onClose={() => setEditingAssignment(null)}
        assignment={editingAssignment}
        onSuccess={() => {
          loadCustomerAssignments();
          Swal.fire('Success', 'Assignment updated successfully!', 'success');
        }}
      />
    </div>
  );
}
