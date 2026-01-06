'use client';

import { useState, useEffect } from 'react';
import { X, Search, Wifi, MapPin, Users } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  username: string;
  phone: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  profile?: {
    name: string;
  };
}

interface ODP {
  id: string;
  name: string;
  distance: number;
  availablePorts: number[];
  assignedCount: number;
  portCount: number;
  ponPort: number;
  latitude: number;
  longitude: number;
  odc?: {
    name: string;
  };
  olt: {
    name: string;
  };
}

interface AssignCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignCustomerDialog({
  isOpen,
  onClose,
  onSuccess,
}: AssignCustomerDialogProps) {
  const [step, setStep] = useState<'customer' | 'odp'>('customer');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [nearestODPs, setNearestODPs] = useState<ODP[]>([]);
  const [selectedODP, setSelectedODP] = useState<ODP | null>(null);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingODPs, setLoadingODPs] = useState(false);
  const [error, setError] = useState('');

  // Fetch unassigned customers with GPS coordinates
  useEffect(() => {
    if (isOpen && step === 'customer') {
      fetchUnassignedCustomers();
    }
  }, [isOpen, step]);

  const fetchUnassignedCustomers = async () => {
    try {
      setLoading(true);
      // Get all customers
      const customersRes = await fetch('/api/pppoe/users');
      const customersData = await customersRes.json();
      const allCustomers = customersData.users || [];

      // Get all assignments
      const assignmentsRes = await fetch('/api/network/customers/assign');
      const assignments = await assignmentsRes.json();

      // Filter out assigned customers and those without GPS
      const assignedCustomerIds = assignments.map((a: any) => a.customerId);
      const unassigned = allCustomers.filter(
        (c: Customer) =>
          !assignedCustomerIds.includes(c.id) &&
          c.latitude != null &&
          c.longitude != null
      );

      setCustomers(unassigned);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchNearestODPs = async (customerId: string) => {
    try {
      setLoadingODPs(true);
      const res = await fetch(
        `/api/network/customers/assign?customerId=${customerId}`
      );
      if (!res.ok) {
        throw new Error('Failed to fetch ODPs');
      }
      const odps = await res.json();
      setNearestODPs(odps);
    } catch (err) {
      console.error('Error fetching ODPs:', err);
      setError('Failed to load ODPs');
    } finally {
      setLoadingODPs(false);
    }
  };

  const handleCustomerSelect = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setSelectedODP(null);
    setSelectedPort(null);
    setStep('odp');
    await fetchNearestODPs(customer.id);
  };

  const handleAssign = async () => {
    if (!selectedCustomer || !selectedODP || !selectedPort) {
      setError('Please select customer, ODP, and port');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/network/customers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          odpId: selectedODP.id,
          portNumber: selectedPort,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to assign customer');
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('customer');
    setSearchCustomer('');
    setSelectedCustomer(null);
    setNearestODPs([]);
    setSelectedODP(null);
    setSelectedPort(null);
    setNotes('');
    setError('');
    onClose();
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      c.username.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      c.address?.toLowerCase().includes(searchCustomer.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Assign Customer to ODP
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Connect customer to available ODP port
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Left: Customer Selection */}
            <div className="transition-opacity">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Select Customer ({filteredCustomers.length})
                </h3>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, username, or address..."
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Customer List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">
                    Loading customers...
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No unassigned customers found
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      All customers with GPS are already assigned to ODPs
                    </p>
                  </div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleCustomerSelect(customer)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedCustomer?.id === customer.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {customer.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {customer.username}
                      </div>
                      {customer.address && (
                        <div className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{customer.address}</span>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          {customer.profile?.name}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            customer.status === 'active'
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {customer.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right: ODP Selection */}
            <div
              className={`${
                step === 'odp' ? 'opacity-100' : 'opacity-50'
              } transition-opacity`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Wifi className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Select ODP ({nearestODPs.length > 0 ? nearestODPs.length : 0})
                </h3>
              </div>

              {step === 'customer' ? (
                <div className="text-center py-12 text-gray-500">
                  Select a customer first
                </div>
              ) : loadingODPs ? (
                <div className="text-center py-12 text-gray-500">
                  Loading nearest ODPs...
                </div>
              ) : nearestODPs.length === 0 ? (
                <div className="text-center py-12">
                  <Wifi className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No ODPs available
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {nearestODPs.map((odp) => (
                    <button
                      key={odp.id}
                      onClick={() => {
                        setSelectedODP(odp);
                        setSelectedPort(null);
                      }}
                      disabled={odp.availablePorts.length === 0}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedODP?.id === odp.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : odp.availablePorts.length === 0
                          ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 dark:border-gray-700 hover:border-green-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {odp.name}
                        </div>
                        <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {odp.distance} km
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <div>OLT: {odp.olt.name} - PON {odp.ponPort}</div>
                        {odp.odc && <div>ODC: {odp.odc.name}</div>}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`px-2 py-1 rounded ${
                              odp.availablePorts.length > 0
                                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                            }`}
                          >
                            {odp.availablePorts.length}/{odp.portCount} ports available
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Port Selection */}
              {selectedODP && selectedODP.availablePorts.length > 0 && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Port
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedODP.availablePorts.map((port) => (
                      <button
                        key={port}
                        onClick={() => setSelectedPort(port)}
                        className={`p-2 rounded-lg border-2 font-medium transition-all ${
                          selectedPort === port
                            ? 'border-green-500 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                            : 'border-gray-300 dark:border-gray-600 hover:border-green-300'
                        }`}
                      >
                        Port {port}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedODP && selectedPort && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this assignment..."
                    rows={3}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={handleClose}
            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedCustomer || !selectedODP || !selectedPort || loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign Customer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
