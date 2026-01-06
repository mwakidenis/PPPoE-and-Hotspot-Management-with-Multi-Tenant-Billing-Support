'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showSuccess, showError } from '@/lib/sweetalert';
import {
  UserPlus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  FileText,
  Wrench,
} from 'lucide-react';
import { formatToWIB } from '@/lib/utils/dateUtils';

interface Registration {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  notes: string | null;
  status: string;
  installationFee: number;
  rejectionReason: string | null;
  createdAt: string;
  profile: {
    id: string;
    name: string;
    price: number;
    downloadSpeed: number;
    uploadSpeed: number;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    amount: number;
  } | null;
  pppoeUser: {
    id: string;
    username: string;
    status: string;
  } | null;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  installed: number;
  active: number;
  rejected: number;
}

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Approve modal
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [installationFee, setInstallationFee] = useState('');
  const [approving, setApproving] = useState(false);

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Mark installed
  const [marking, setMarking] = useState(false);

  const fetchRegistrations = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (searchFilter) params.set('search', searchFilter);

      const res = await fetch(`/api/admin/registrations?${params}`);
      const data = await res.json();
      setRegistrations(data.registrations || []);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [statusFilter, searchFilter]);

  const handleApproveClick = (registration: Registration) => {
    setSelectedRegistration(registration);
    setInstallationFee('');
    setApproveModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRegistration || !installationFee) return;

    setApproving(true);
    try {
      const res = await fetch(`/api/admin/registrations/${selectedRegistration.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installationFee: parseFloat(installationFee) }),
      });

      const data = await res.json();

      if (res.ok) {
        await showSuccess(`Registration approved!\nUsername: ${data.pppoeUser.username}\nPassword: ${data.pppoeUser.password}\nStatus: Isolated (pending payment)`);
        setApproveModalOpen(false);
        fetchRegistrations();
      } else {
        await showError(data.error || 'Failed to approve registration');
      }
    } catch (error) {
      console.error('Approve error:', error);
      await showError('Failed to approve registration');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectClick = (registration: Registration) => {
    setSelectedRegistration(registration);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRegistration || !rejectionReason) return;

    setRejecting(true);
    try {
      const res = await fetch(`/api/admin/registrations/${selectedRegistration.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      const data = await res.json();

      if (res.ok) {
        await showSuccess('Registration rejected');
        setRejectModalOpen(false);
        fetchRegistrations();
      } else {
        await showError(data.error || 'Failed to reject registration');
      }
    } catch (error) {
      console.error('Reject error:', error);
      await showError('Failed to reject registration');
    } finally {
      setRejecting(false);
    }
  };

  const handleMarkInstalled = async (registration: Registration) => {
    setMarking(true);
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}/mark-installed`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        await showSuccess(`Installation marked as done!\nInvoice: ${data.invoice.invoiceNumber}\nAmount: Rp ${data.invoice.amount.toLocaleString()}`);
        fetchRegistrations();
      } else {
        await showError(data.error || 'Failed to mark installation');
      }
    } catch (error) {
      console.error('Mark installed error:', error);
      await showError('Failed to mark installation');
    } finally {
      setMarking(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'APPROVED':
        return <Badge className="bg-blue-100 text-blue-800">Approved</Badge>;
      case 'INSTALLED':
        return <Badge className="bg-purple-100 text-purple-800">Installed</Badge>;
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
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
            <UserPlus className="w-7 h-7 text-blue-600" />
            Registration Requests
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage customer registration and approval
          </p>
        </div>
        <Button onClick={fetchRegistrations}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-yellow-600">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-blue-600">Approved</div>
              <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-purple-600">Installed</div>
              <div className="text-2xl font-bold text-purple-600">{stats.installed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-green-600">Active</div>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-red-600">Rejected</div>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search name, phone, email..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="INSTALLED">Installed</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registrations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PPPoE User</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      No registrations found
                    </TableCell>
                  </TableRow>
                ) : (
                  registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div className="font-medium">{reg.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {reg.address}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{reg.phone}</div>
                        {reg.email && (
                          <div className="text-xs text-gray-500">{reg.email}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{reg.profile.name}</div>
                        <div className="text-xs text-gray-500">
                          {reg.profile.downloadSpeed}/{reg.profile.uploadSpeed} Mbps
                        </div>
                        <div className="text-xs text-green-600 font-medium">
                          Rp {reg.profile.price.toLocaleString()}/mo
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(reg.status)}</TableCell>
                      <TableCell>
                        {reg.pppoeUser ? (
                          <div>
                            <div className="font-mono text-sm">{reg.pppoeUser.username}</div>
                            <Badge
                              variant="outline"
                              className={
                                reg.pppoeUser.status === 'isolated'
                                  ? 'text-orange-600'
                                  : 'text-green-600'
                              }
                            >
                              {reg.pppoeUser.status}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Not created</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {reg.invoice ? (
                          <div>
                            <div className="font-mono text-sm">{reg.invoice.invoiceNumber}</div>
                            <div className="text-xs text-gray-600">
                              Rp {reg.invoice.amount.toLocaleString()}
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                reg.invoice.status === 'PAID'
                                  ? 'text-green-600'
                                  : 'text-yellow-600'
                              }
                            >
                              {reg.invoice.status}
                            </Badge>
                          </div>
                        ) : reg.status === 'APPROVED' ? (
                          <span className="text-blue-600 text-sm">Awaiting installation</span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatToWIB(reg.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {reg.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApproveClick(reg)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectClick(reg)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {reg.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkInstalled(reg)}
                              disabled={marking}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              <Wrench className="w-4 h-4 mr-1" />
                              Mark Installed
                            </Button>
                          )}
                          {reg.status === 'INSTALLED' && (
                            <span className="text-sm text-gray-600">
                              Waiting payment...
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Approve Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Registration</DialogTitle>
            <DialogDescription>
              Set installation fee and create PPPoE user account
            </DialogDescription>
          </DialogHeader>

          {selectedRegistration && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Name:</span>
                  <span className="font-medium">{selectedRegistration.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Phone:</span>
                  <span className="font-medium">{selectedRegistration.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Profile:</span>
                  <span className="font-medium">{selectedRegistration.profile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Username will be:</span>
                  <span className="font-mono font-medium">
                    {selectedRegistration.name.split(' ')[0].toLowerCase()}-
                    {selectedRegistration.phone}
                  </span>
                </div>
              </div>

              <div>
                <Label>Installation Fee (Rp) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 350000"
                  value={installationFee}
                  onChange={(e) => setInstallationFee(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={!installationFee || approving}
              className="bg-green-600 hover:bg-green-700"
            >
              {approving ? 'Approving...' : 'Approve & Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label>Rejection Reason *</Label>
            <textarea
              className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g. Area not covered, incomplete information..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectionReason || rejecting}
              variant="destructive"
            >
              {rejecting ? 'Rejecting...' : 'Reject Registration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
