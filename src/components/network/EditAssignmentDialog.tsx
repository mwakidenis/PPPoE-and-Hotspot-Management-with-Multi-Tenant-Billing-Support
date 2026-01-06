'use client';

import { useState, useEffect } from 'react';
import { X, Wifi } from 'lucide-react';

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

interface Assignment {
  id: string;
  customerId: string;
  odpId: string;
  portNumber: number;
  notes?: string;
  customer: {
    id: string;
    name: string;
    username: string;
    latitude?: number;
    longitude?: number;
  };
  odp: {
    id: string;
    name: string;
    portCount: number;
  };
}

interface EditAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assignment: Assignment | null;
}

export default function EditAssignmentDialog({
  isOpen,
  onClose,
  onSuccess,
  assignment,
}: EditAssignmentDialogProps) {
  const [nearestODPs, setNearestODPs] = useState<ODP[]>([]);
  const [selectedODP, setSelectedODP] = useState<ODP | null>(null);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingODPs, setLoadingODPs] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && assignment) {
      setNotes(assignment.notes || '');
      setSelectedPort(assignment.portNumber);
      fetchNearestODPs(assignment.customerId);
    }
  }, [isOpen, assignment]);

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

      // Find and set current ODP
      const currentOdp = odps.find((o: ODP) => o.id === assignment?.odpId);
      if (currentOdp) {
        setSelectedODP(currentOdp);
      }
    } catch (err) {
      console.error('Error fetching ODPs:', err);
      setError('Failed to load ODPs');
    } finally {
      setLoadingODPs(false);
    }
  };

  const handleUpdate = async () => {
    if (!assignment || !selectedODP || !selectedPort) {
      setError('Please select ODP and port');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/network/customers/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: assignment.id,
          odpId: selectedODP.id,
          portNumber: selectedPort,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update assignment');
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
    setNearestODPs([]);
    setSelectedODP(null);
    setSelectedPort(null);
    setNotes('');
    setError('');
    onClose();
  };

  if (!isOpen || !assignment) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Edit Assignment
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {assignment.customer.name} ({assignment.customer.username})
            </p>
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

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Wifi className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Select ODP ({nearestODPs.length > 0 ? nearestODPs.length : 0})
              </h3>
            </div>

            {loadingODPs ? (
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
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {nearestODPs.map((odp) => {
                  const isCurrentOdp = odp.id === assignment.odpId;
                  // For current ODP, include the current port in available ports
                  const availablePorts = isCurrentOdp 
                    ? [...odp.availablePorts, assignment.portNumber].sort((a, b) => a - b)
                    : odp.availablePorts;

                  return (
                    <button
                      key={odp.id}
                      onClick={() => {
                        setSelectedODP(odp);
                        // Reset port selection when changing ODP
                        if (odp.id !== assignment.odpId) {
                          setSelectedPort(null);
                        } else {
                          setSelectedPort(assignment.portNumber);
                        }
                      }}
                      disabled={availablePorts.length === 0}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedODP?.id === odp.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : availablePorts.length === 0
                          ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 dark:border-gray-700 hover:border-green-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {odp.name}
                            </span>
                            {isCurrentOdp && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                                Current
                              </span>
                            )}
                          </div>
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
                              availablePorts.length > 0
                                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                            }`}
                          >
                            {availablePorts.length}/{odp.portCount} ports available
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Port Selection */}
            {selectedODP && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Port
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(() => {
                    const isCurrentOdp = selectedODP.id === assignment.odpId;
                    const availablePorts = isCurrentOdp 
                      ? [...selectedODP.availablePorts, assignment.portNumber].sort((a, b) => a - b)
                      : selectedODP.availablePorts;
                    
                    return availablePorts.map((port) => (
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
                    ));
                  })()}
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

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={handleClose}
            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={!selectedODP || !selectedPort || loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating...
              </>
            ) : (
              'Update Assignment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
