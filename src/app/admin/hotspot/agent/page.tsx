'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';

import { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  TrendingUp,
  Calendar,
  Eye,
  X,
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    currentMonth: {
      total: number;
      count: number;
    };
    allTime: {
      total: number;
      count: number;
    };
  };
}

interface MonthlyHistory {
  year: number;
  month: number;
  monthName: string;
  total: number;
  count: number;
}

interface MonthDetail {
  month: number;
  year: number;
  total: number;
  count: number;
  sales: {
    id: string;
    voucherCode: string;
    profileName: string;
    amount: number;
    createdAt: string;
  }[];
}

export default function AgentPage() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null);
  
  // Get current month name
  const currentMonthName = new Date().toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
  
  // History modal states
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyHistory[]>([]);
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<MonthDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await fetch('/api/hotspot/agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Load agents error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = '/api/hotspot/agents';
      const method = editingAgent ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        ...(editingAgent && { id: editingAgent.id }),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        setIsDialogOpen(false);
        setEditingAgent(null);
        resetForm();
        loadData();
        await showSuccess(editingAgent ? 'Agent updated!' : 'Agent created!');
      } else {
        await showError('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Submit error:', error);
      await showError('Failed to save agent');
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      phone: agent.phone,
      email: agent.email || '',
      address: agent.address || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteAgentId) return;
    
    const confirmed = await showConfirm('Are you sure you want to delete this agent?');
    if (!confirmed) {
      setDeleteAgentId(null);
      return;
    }

    try {
      const res = await fetch(`/api/hotspot/agents?id=${deleteAgentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await showSuccess('Agent deleted successfully!');
        loadData();
      } else {
        const result = await res.json();
        await showError(result.error || 'Failed to delete agent');
      }
    } catch (error) {
      console.error('Delete error:', error);
      await showError('Failed to delete agent');
    } finally {
      setDeleteAgentId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
    });
  };

  const handleViewHistory = async (agent: Agent) => {
    setSelectedAgent(agent);
    setHistoryModalOpen(true);
    setLoadingHistory(true);

    try {
      const res = await fetch(`/api/hotspot/agents/${agent.id}/history`);
      const data = await res.json();
      setMonthlyHistory(data.history || []);
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewMonthDetail = async (year: number, month: number) => {
    if (!selectedAgent) return;

    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/hotspot/agents/${selectedAgent.id}/history?year=${year}&month=${month}`
      );
      const data = await res.json();
      setSelectedMonthDetail(data);
    } catch (error) {
      console.error('Load month detail error:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Agent Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage hotspot voucher agents and track their sales history by month
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingAgent(null);
            setIsDialogOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Agent
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Agents</p>
              <p className="text-2xl font-bold mt-1">{agents.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Agents</p>
              <p className="text-2xl font-bold mt-1">
                {agents.filter((a) => a.isActive).length}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales (All Time)</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(
                  agents.reduce((sum, a) => sum + a.stats.allTime.total, 0)
                )}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Agents List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold">Agents List</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>
                    <div>Current Month</div>
                    <div className="text-[10px] font-normal normal-case text-gray-400">
                      {currentMonthName}
                    </div>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  All Time
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
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No agents found. Add your first agent to get started.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {agent.name}
                      </p>
                      {agent.email && (
                        <p className="text-xs text-gray-500 mt-1">{agent.email}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">{agent.phone}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-sm">
                          {formatCurrency(agent.stats.currentMonth.total)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {agent.stats.currentMonth.count} vouchers
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-sm">
                          {formatCurrency(agent.stats.allTime.total)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {agent.stats.allTime.count} vouchers
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          agent.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewHistory(agent)}
                          className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition"
                          title="View History"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(agent)}
                          className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteAgentId(agent.id)}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                {editingAgent ? 'Edit Agent' : 'Add New Agent'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Agent Name"
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

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="agent@example.com"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Agent address"
                  rows={3}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingAgent(null);
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
                  {editingAgent ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteAgentId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-2">Delete Agent</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure? This will also delete all sales history.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteAgentId(null)}
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

      {/* History Modal */}
      {historyModalOpen && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{selectedAgent.name} - Sales History</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedAgent.phone}</p>
              </div>
              <button
                onClick={() => {
                  setHistoryModalOpen(false);
                  setSelectedAgent(null);
                  setSelectedMonthDetail(null);
                  setMonthlyHistory([]);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-gray-500">Loading...</p>
                </div>
              ) : selectedMonthDetail ? (
                <div>
                  <button
                    onClick={() => setSelectedMonthDetail(null)}
                    className="text-sm text-blue-600 hover:text-blue-700 mb-4"
                  >
                    ← Back to monthly summary
                  </button>

                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                    <p className="text-lg font-semibold">
                      {new Date(selectedMonthDetail.year, selectedMonthDetail.month).toLocaleString(
                        'id-ID',
                        { month: 'long', year: 'numeric' }
                      )}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
                        <p className="text-xl font-bold">
                          {formatCurrency(selectedMonthDetail.total)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Vouchers Sold</p>
                        <p className="text-xl font-bold">{selectedMonthDetail.count}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedMonthDetail.sales.map((sale) => (
                      <div
                        key={sale.id}
                        className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{sale.voucherCode}</p>
                            <p className="text-sm text-gray-500">{sale.profileName}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDate(sale.createdAt)}
                            </p>
                          </div>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(sale.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {monthlyHistory.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No sales history yet</p>
                  ) : (
                    monthlyHistory.map((month) => (
                      <button
                        key={`${month.year}-${month.month}`}
                        onClick={() => handleViewMonthDetail(month.year, month.month - 1)}
                        className="w-full border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left transition"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{month.monthName}</p>
                            <p className="text-sm text-gray-500">{month.count} vouchers</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">
                              {formatCurrency(month.total)}
                            </p>
                            <Eye className="h-4 w-4 text-gray-400 ml-auto mt-1" />
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
