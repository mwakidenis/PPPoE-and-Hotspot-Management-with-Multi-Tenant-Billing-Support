'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';
import { usePermissions } from '@/hooks/usePermissions';

import { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  MapPin,
  Map,
  MoreVertical,
  Shield,
  ShieldOff,
  Ban,
  Download,
  Upload,
  FileSpreadsheet,
  Search,
  Filter,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';
import UserDetailModal from '@/components/UserDetailModal';
import { formatWIB, isExpiredWIB as isExpired, endOfDayWIBtoUTC } from '@/lib/timezone';

interface PppoeUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  ipAddress: string | null;
  expiredAt: string | null;
  syncedToRadius: boolean;
  createdAt: string;
  profile: {
    id: string;
    name: string;
    groupName: string;
  };
  router?: {
    id: string;
    name: string;
    nasname: string;
    ipAddress: string;
  } | null;
  routerId?: string | null;
}

interface Profile {
  id: string;
  name: string;
  groupName: string;
  price: number;
}

interface Router {
  id: string;
  name: string;
  nasname: string;
  ipAddress: string;
}

export default function PppoeUsersPage() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<PppoeUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PppoeUser | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [modalLatLng, setModalLatLng] = useState<{ lat: string; lng: string } | undefined>();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProfile, setFilterProfile] = useState('');
  const [filterRouter, setFilterRouter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Import/Export states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProfileId, setImportProfileId] = useState('');
  const [importRouterId, setImportRouterId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    profileId: '',
    routerId: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    latitude: '',
    longitude: '',
    ipAddress: '',
    expiredAt: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, profilesRes, routersRes] = await Promise.all([
        fetch('/api/pppoe/users'),
        fetch('/api/pppoe/profiles'),
        fetch('/api/network/routers'),
      ]);

      const usersData = await usersRes.json();
      const profilesData = await profilesRes.json();
      const routersData = await routersRes.json();

      setUsers(usersData.users || []);
      setProfiles(profilesData.profiles || []);
      setRouters(routersData.routers || []);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = '/api/pppoe/users';
      const method = editingUser ? 'PUT' : 'POST';

      // Convert expiredAt from WIB date to UTC datetime for database
      const payload = {
        ...formData,
        ...(editingUser && { id: editingUser.id }),
        // If expiredAt provided, convert WIB date (YYYY-MM-DD) to end of day UTC
        ...(formData.expiredAt && {
          expiredAt: endOfDayWIBtoUTC(new Date(formData.expiredAt + 'T23:59:59')).toISOString()
        }),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        setIsDialogOpen(false);
        setEditingUser(null);
        resetForm();
        loadData();
        await showSuccess(
          editingUser
            ? 'User updated successfully!'
            : 'User created successfully!'
        );
      } else {
        await showError('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Submit error:', error);
      await showError('Failed to save user');
    }
  };

  const handleSaveUser = async (data: any) => {
    try {
      const url = '/api/pppoe/users';
      const method = 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        loadData();
        await showSuccess('User updated successfully!');
      } else {
        await showError('Error: ' + result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Save user error:', error);
      await showError('Failed to save user');
      throw error;
    }
  };

  const handleEdit = (user: PppoeUser) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      profileId: user.profile.id,
      routerId: user.routerId || '',
      name: user.name,
      phone: user.phone,
      email: user.email || '',
      address: user.address || '',
      latitude: user.latitude?.toString() || '',
      longitude: user.longitude?.toString() || '',
      ipAddress: user.ipAddress || '',
      expiredAt: user.expiredAt ? formatWIB(user.expiredAt, 'yyyy-MM-dd') : '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    
    const confirmed = await showConfirm('Are you sure? This will remove the user from RADIUS and cannot be undone.');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/pppoe/users?id=${deleteUserId}`, {
        method: 'DELETE',
      });

      const result = await res.json();

      if (res.ok) {
        await showSuccess('User deleted successfully!');
        loadData();
      } else {
        await showError(result.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Delete error:', error);
      await showError('Failed to delete user');
    } finally {
      setDeleteUserId(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/pppoe/users/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus }),
      });

      const result = await res.json();

      if (res.ok) {
        await showSuccess(`Status changed to ${newStatus}`);
        loadData();
        setActionMenuOpen(null);
      } else {
        await showError(result.error || 'Failed to change status');
      }
    } catch (error) {
      console.error('Status change error:', error);
      await showError('Failed to change status');
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedUsers.size === 0) return;
    
    const confirmed = await showConfirm(`Update ${selectedUsers.size} user(s) to ${newStatus} status?`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/pppoe/users/bulk-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userIds: Array.from(selectedUsers),
          status: newStatus 
        }),
      });

      const result = await res.json();

      if (res.ok) {
        await showSuccess(`${selectedUsers.size} users updated to ${newStatus}`);
        setSelectedUsers(new Set());
        loadData();
      } else {
        await showError(result.error || 'Failed to update users');
      }
    } catch (error) {
      console.error('Bulk status change error:', error);
      await showError('Failed to update users');
    }
  };

  const toggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      profileId: '',
      routerId: '',
      name: '',
      phone: '',
      email: '',
      address: '',
      latitude: '',
      longitude: '',
      ipAddress: '',
      expiredAt: '',
    });
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    
    const confirmed = await showConfirm(`Are you sure you want to delete ${selectedUsers.size} user(s)?`);
    if (!confirmed) return;

    try {
      const deletePromises = Array.from(selectedUsers).map(id => 
        fetch(`/api/pppoe/users?id=${id}`, { method: 'DELETE' })
      );
      
      await Promise.all(deletePromises);
      await showSuccess(`${selectedUsers.size} user(s) deleted successfully!`);
      setSelectedUsers(new Set());
      loadData();
    } catch (error) {
      console.error('Bulk delete error:', error);
      await showError('Failed to delete users');
    }
  };

  const handleExportSelected = async () => {
    if (selectedUsers.size === 0) return;

    try {
      // Fetch full user data with passwords from API
      const selectedUsersData = users.filter(u => selectedUsers.has(u.id));
      
      // Fetch each user's password from API
      const usersWithPasswords = await Promise.all(
        selectedUsersData.map(async (u) => {
          try {
            const res = await fetch(`/api/pppoe/users/${u.id}`);
            const data = await res.json();
            return { ...u, password: data.user?.password || '' };
          } catch {
            return { ...u, password: '' };
          }
        })
      );

      const csvContent = [
        ['Username', 'Password', 'Name', 'Phone', 'Email', 'Address', 'IP Address', 'Profile', 'Router', 'Status', 'Expired At'].join(','),
        ...usersWithPasswords.map(u => [
          u.username,
          u.password,
          u.name,
          u.phone,
          u.email || '',
          u.address || '',
          u.ipAddress || '',
          u.profile.name,
          u.router?.name || 'Global',
          u.status,
          u.expiredAt ? formatWIB(u.expiredAt) : ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pppoe-users-selected-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export selected error:', error);
      await showError('Failed to export selected users');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/pppoe/users/bulk?type=template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pppoe-users-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download template error:', error);
      await showError('Failed to download template');
    }
  };

  const handleExportData = async () => {
    try {
      const res = await fetch('/api/pppoe/users/bulk?type=export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pppoe-users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export data error:', error);
      await showError('Failed to export data');
    }
  };

  const handleImport = async () => {
    if (!importFile || !importProfileId) {
      await showError('Please select a file and PPPoE profile');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('pppoeProfileId', importProfileId);
      if (importRouterId) formData.append('routerId', importRouterId);

      const res = await fetch('/api/pppoe/users/bulk', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setImportResult(data.results);
        loadData();
        if (data.results.failed === 0) {
          setTimeout(() => {
            setIsImportDialogOpen(false);
            setImportFile(null);
            setImportProfileId('');
            setImportRouterId('');
            setImportResult(null);
          }, 3000);
        }
      } else {
        await showError('Import failed: ' + data.error);
      }
    } catch (error) {
      console.error('Import error:', error);
      await showError('Import failed. Please check your file format.');
    } finally {
      setImporting(false);
    }
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter((user) => {
    const matchesSearch = searchQuery === '' || 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery);
    
    const matchesProfile = filterProfile === '' || user.profile.id === filterProfile;
    const matchesRouter = filterRouter === '' || 
      (filterRouter === 'global' ? !user.routerId : user.routerId === filterRouter);
    const matchesStatus = filterStatus === '' || user.status === filterStatus;
    
    return matchesSearch && matchesProfile && matchesRouter && matchesStatus;
  });

  const activeUsers = filteredUsers.filter((u) => u.status === 'active').length;
  const expiredUsers = filteredUsers.filter((u) =>
    u.expiredAt ? isExpired(u.expiredAt) : false
  ).length;

  // Permission checks
  const canView = hasPermission('customers.view');
  const canCreate = hasPermission('customers.create');
  const canEdit = hasPermission('customers.edit');
  const canDelete = hasPermission('customers.delete');
  const canIsolate = hasPermission('customers.isolate');

  // Access denied if no view permission
  if (!permLoading && !canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Shield className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Access Denied
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          You don't have permission to view PPPoE users.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
            PPPoE Users
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage PPPoE user accounts with auto-sync to FreeRADIUS
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <Download className="h-4 w-4 mr-2" />
            Template
          </button>
          <button
            onClick={handleExportData}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={() => setIsImportDialogOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </button>
          {canCreate && (
            <button
              onClick={() => {
                resetForm();
                setEditingUser(null);
                setIsDialogOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
              <p className="text-2xl font-bold mt-1">{activeUsers}</p>
            </div>
            <Users className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Expired Users</p>
              <p className="text-2xl font-bold mt-1">{expiredUsers}</p>
            </div>
            <Users className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold mt-1">{users.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Bar */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by username, name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Profile Filter */}
          <div>
            <select
              value={filterProfile}
              onChange={(e) => setFilterProfile(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
            >
              <option value="">All Profiles</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          {/* Router Filter */}
          <div>
            <select
              value={filterRouter}
              onChange={(e) => setFilterRouter(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
            >
              <option value="">All NAS</option>
              <option value="global">Global (No NAS)</option>
              {routers.map((router) => (
                <option key={router.id} value={router.id}>
                  {router.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Row */}
        <div className="flex items-center gap-2 mt-4">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('')}
              className={`px-3 py-1 text-xs rounded-full transition ${
                filterStatus === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-1 text-xs rounded-full transition ${
                filterStatus === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('isolated')}
              className={`px-3 py-1 text-xs rounded-full transition ${
                filterStatus === 'isolated'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Isolated
            </button>
            <button
              onClick={() => setFilterStatus('blocked')}
              className={`px-3 py-1 text-xs rounded-full transition ${
                filterStatus === 'blocked'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Blocked
            </button>
          </div>
          {(searchQuery || filterProfile || filterRouter || filterStatus) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterProfile('');
                setFilterRouter('');
                setFilterStatus('');
              }}
              className="ml-auto text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-500">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">PPPoE Users List</h2>
            <p className="text-sm text-gray-500 mt-1">
              All users are automatically synced to FreeRADIUS radcheck table
            </p>
          </div>
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedUsers.size} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkStatusChange('active')}
                  className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1"
                >
                  <Shield className="h-3 w-3" />
                  Aktifkan
                </button>
                <button
                  onClick={() => handleBulkStatusChange('isolated')}
                  className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded flex items-center gap-1"
                >
                  <ShieldOff className="h-3 w-3" />
                  Isolir
                </button>
                <button
                  onClick={() => handleBulkStatusChange('blocked')}
                  className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1"
                >
                  <Ban className="h-3 w-3" />
                  Blokir
                </button>
                <button
                  onClick={handleExportSelected}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  Export
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profile
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expired At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {users.length === 0 ? 'No users found. Add your first user to get started.' : 'No users match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => toggleSelectUser(user.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {user.username}
                      </p>
                      {user.ipAddress && (
                        <p className="text-xs text-gray-500 mt-1">IP: {user.ipAddress}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 dark:text-gray-100">{user.name}</p>
                      {user.email && (
                        <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">{user.phone}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-sm">{user.profile.name}</p>
                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        {user.profile.groupName}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {user.expiredAt ? (
                        <span
                          className={
                            isExpired(user.expiredAt)
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : 'text-gray-900 dark:text-gray-100'
                          }
                        >
                          {formatWIB(user.expiredAt, 'dd/MM/yyyy')}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : user.status === 'isolated'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}
                        >
                          {user.status}
                        </span>
                        {user.syncedToRadius && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Synced
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <div className="relative">
                          <button
                            onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                            className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {actionMenuOpen === user.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border dark:border-gray-600 z-10">
                              <div className="py-1">
                                <button
                                  onClick={() => handleStatusChange(user.id, 'active')}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                  <Shield className="h-4 w-4 text-green-600" />
                                  Set Active
                                </button>
                                <button
                                  onClick={() => handleStatusChange(user.id, 'isolated')}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                  <ShieldOff className="h-4 w-4 text-yellow-600" />
                                  Isolir
                                </button>
                                <button
                                  onClick={() => handleStatusChange(user.id, 'blocked')}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                  <Ban className="h-4 w-4 text-red-600" />
                                  Block
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteUserId(user.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Add New User Dialog (only for new user) */}
      {isDialogOpen && !editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                Add New User
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Create a new PPPoE user with RADIUS authentication.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="user001"
                    required
                    disabled={!!editingUser}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Password *
                    {editingUser && ' (leave empty to keep current)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="********"
                      required={!editingUser}
                      className="w-full px-3 py-2 pr-10 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Profile *</label>
                <select
                  value={formData.profileId}
                  onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                >
                  <option value="">Select Profile</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} - {profile.groupName} - Rp{' '}
                      {profile.price.toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">NAS / Router (Optional)</label>
                <select
                  value={formData.routerId}
                  onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                >
                  <option value="">Global (All NAS)</option>
                  {routers.map((router) => (
                    <option key={router.id} value={router.id}>
                      {router.name} ({router.ipAddress})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Assign to specific NAS or leave global
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="08123456789"
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="User address"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">GPS Location (Optional)</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                    >
                      <Map className="h-3 w-3 mr-1" />
                      Pilih di Peta
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              setFormData({
                                ...formData,
                                latitude: position.coords.latitude.toFixed(6),
                                longitude: position.coords.longitude.toFixed(6)
                              });
                            },
                            async (error) => {
                              await showError('Failed to get location: ' + error.message);
                            }
                          );
                        } else {
                          await showError('Geolocation is not supported by this browser.');
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
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="Longitude"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Pilih di peta atau gunakan GPS otomatis
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Static IP (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, ipAddress: e.target.value })
                    }
                    placeholder="10.10.10.2"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty for dynamic IP assignment
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.expiredAt}
                    onChange={(e) => setFormData({ ...formData, expiredAt: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-calculated from profile if empty
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingUser(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Picker Modal */}
      <MapPicker
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onSelect={(lat, lng) => {
          const latStr = lat.toFixed(6);
          const lngStr = lng.toFixed(6);
          setFormData({
            ...formData,
            latitude: latStr,
            longitude: lngStr
          });
          // Also update modal state if editing user
          if (editingUser) {
            setModalLatLng({ lat: latStr, lng: lngStr });
          }
        }}
        initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
        initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
      />

      {/* Import CSV Dialog */}
      {isImportDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-2">Import PPPoE Users from CSV</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Upload a CSV file with user data. All users will be assigned to the selected profile.
            </p>

            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">CSV File *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                  {importFile && <FileSpreadsheet className="h-5 w-5 text-green-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Required: username, password, name, phone | Optional: email, address, ipAddress, expiredAt, latitude, longitude
                </p>
              </div>

              {/* PPPoE Profile */}
              <div>
                <label className="block text-sm font-medium mb-2">PPPoE Profile *</label>
                <select
                  value={importProfileId}
                  onChange={(e) => setImportProfileId(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                >
                  <option value="">Select profile...</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} - {profile.groupName} - Rp{' '}
                      {profile.price.toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  All imported users will be assigned to this profile
                </p>
              </div>

              {/* Router/NAS */}
              <div>
                <label className="block text-sm font-medium mb-2">NAS / Router (Optional)</label>
                <select
                  value={importRouterId}
                  onChange={(e) => setImportRouterId(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                >
                  <option value="">Global (All NAS)</option>
                  {routers.map((router) => (
                    <option key={router.id} value={router.id}>
                      {router.name} ({router.ipAddress})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Assign users to specific NAS or leave global
                </p>
              </div>

              {/* Import Result */}
              {importResult && (
                <div className="p-4 border rounded-lg space-y-2 bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium">
                      {importResult.success} users created successfully
                    </span>
                  </div>
                  {importResult.failed > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-red-600 font-medium">
                        {importResult.failed} users failed:
                      </p>
                      <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                        {importResult.errors.map((err: any, idx: number) => (
                          <div key={idx} className="text-red-600">
                            Line {err.line} ({err.username}): {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsImportDialogOpen(false);
                  setImportFile(null);
                  setImportProfileId('');
                  setImportRouterId('');
                  setImportResult(null);
                }}
                className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || !importProfileId || importing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
              >
                {importing ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-pulse" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Users
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Detail Modal (with tabs) */}
      <UserDetailModal
        isOpen={isDialogOpen && !!editingUser}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingUser(null);
          resetForm();
          setModalLatLng(undefined);
        }}
        user={editingUser}
        onSave={handleSaveUser}
        profiles={profiles}
        routers={routers}
        currentLatLng={modalLatLng}
        onLatLngChange={(lat, lng) => {
          // Open map picker when button clicked
          setFormData({ ...formData, latitude: lat, longitude: lng });
          setShowMapPicker(true);
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-2">Delete User</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure? This will remove the user from RADIUS and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteUserId(null)}
                className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
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
