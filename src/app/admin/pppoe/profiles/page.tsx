'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';

import { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';

interface PPPoEProfile {
  id: string;
  name: string;
  description: string | null;
  price: number;
  downloadSpeed: number;
  uploadSpeed: number;
  groupName: string;
  validityValue: number;
  validityUnit: 'DAYS' | 'MONTHS';
  isActive: boolean;
  syncedToRadius: boolean;
  createdAt: string;
}

export default function PPPoEProfilesPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<PPPoEProfile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PPPoEProfile | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    downloadSpeed: '',
    uploadSpeed: '',
    groupName: '',
    validityValue: '1',
    validityUnit: 'MONTHS' as 'DAYS' | 'MONTHS',
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/pppoe/profiles');
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch (error) {
      console.error('Load profiles error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = '/api/pppoe/profiles';
      const method = editingProfile ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        ...(editingProfile && { id: editingProfile.id }),
        price: parseInt(formData.price),
        downloadSpeed: parseInt(formData.downloadSpeed),
        uploadSpeed: parseInt(formData.uploadSpeed),
        validityValue: parseInt(formData.validityValue),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        setIsDialogOpen(false);
        setEditingProfile(null);
        resetForm();
        loadProfiles();
        await showSuccess(
          editingProfile
            ? 'Profile updated successfully!'
            : 'Profile created successfully!'
        );
      } else {
        await showError('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Submit error:', error);
      await showError('Failed to save profile');
    }
  };

  const handleEdit = (profile: PPPoEProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      description: profile.description || '',
      price: profile.price.toString(),
      downloadSpeed: profile.downloadSpeed.toString(),
      uploadSpeed: profile.uploadSpeed.toString(),
      groupName: profile.groupName,
      validityValue: profile.validityValue.toString(),
      validityUnit: profile.validityUnit,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteProfileId) return;
    
    const confirmed = await showConfirm('Are you sure? This will remove the profile from RADIUS and cannot be undone.');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/pppoe/profiles?id=${deleteProfileId}`, {
        method: 'DELETE',
      });

      const result = await res.json();

      if (res.ok) {
        await showSuccess('Profile deleted successfully!');
        loadProfiles();
      } else {
        await showError(result.error || 'Failed to delete profile');
      }
    } catch (error) {
      console.error('Delete error:', error);
      await showError('Failed to delete profile');
    } finally {
      setDeleteProfileId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      downloadSpeed: '',
      uploadSpeed: '',
      groupName: '',
      validityValue: '1',
      validityUnit: 'MONTHS',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading profiles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
            PPPoE Profiles
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage PPPoE connection profiles with auto-sync to FreeRADIUS
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setEditingProfile(null);
            setIsDialogOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Profile
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Profiles</p>
              <p className="text-2xl font-bold mt-1">{profiles.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Profiles</p>
              <p className="text-2xl font-bold mt-1">
                {profiles.filter((p) => p.isActive).length}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Synced to RADIUS</p>
              <p className="text-2xl font-bold mt-1">
                {profiles.filter((p) => p.syncedToRadius).length}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold">PPPoE Profiles List</h2>
          <p className="text-sm text-gray-500 mt-1">
            All profiles are automatically synced to FreeRADIUS radgroupreply table
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profile Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Group Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Speed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validity
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
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No profiles found. Add your first profile to get started.
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {profile.name}
                      </p>
                      {profile.description && (
                        <p className="text-xs text-gray-500 mt-1">{profile.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">{profile.groupName}</td>
                    <td className="px-6 py-4">Rp {profile.price.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 font-mono text-sm">
                      {profile.downloadSpeed}M / {profile.uploadSpeed}M
                    </td>
                    <td className="px-6 py-4">
                      {profile.validityValue} {profile.validityUnit === 'MONTHS' ? 'Month(s)' : 'Day(s)'}
                    </td>
                    <td className="px-6 py-4">
                      {profile.syncedToRadius ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                          <XCircle className="h-3 w-3 mr-1" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(profile)}
                          className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteProfileId(profile.id)}
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

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                {editingProfile ? 'Edit Profile' : 'Add New Profile'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {editingProfile
                  ? 'Update profile configuration.'
                  : 'Create a new PPPoE profile with rate limits.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Profile Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Premium 10 Mbps"
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">RADIUS Group Name *</label>
                  <input
                    type="text"
                    value={formData.groupName}
                    onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                    placeholder="premium-10mbps"
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must match MikroTik PPP profile name</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Price (IDR) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="250000"
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Validity Period *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={formData.validityValue}
                      onChange={(e) =>
                        setFormData({ ...formData, validityValue: e.target.value })
                      }
                      placeholder="1"
                      required
                      className="w-24 px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                    <select
                      value={formData.validityUnit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          validityUnit: e.target.value as 'DAYS' | 'MONTHS',
                        })
                      }
                      className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    >
                      <option value="DAYS">Days</option>
                      <option value="MONTHS">Months</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Billing cycle period</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Download Speed (Mbps) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.downloadSpeed}
                    onChange={(e) =>
                      setFormData({ ...formData, downloadSpeed: e.target.value })
                    }
                    placeholder="10"
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">Speed in Mbps (e.g. 10 = 10M)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Upload Speed (Mbps) *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.uploadSpeed}
                    onChange={(e) => setFormData({ ...formData, uploadSpeed: e.target.value })}
                    placeholder="10"
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">Speed in Mbps (e.g. 10 = 10M)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Premium package with 10 Mbps speed"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingProfile(null);
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
                  {editingProfile ? 'Update Profile' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteProfileId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-2">Delete Profile</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure? This will remove the profile from RADIUS and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteProfileId(null)}
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
