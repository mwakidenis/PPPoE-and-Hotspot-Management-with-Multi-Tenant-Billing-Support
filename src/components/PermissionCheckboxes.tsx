'use client';

import { useState, useEffect } from 'react';
import { Check, RefreshCw, CheckSquare, Square } from 'lucide-react';

interface Permission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
}

interface PermissionCheckboxesProps {
  role: string;
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  userId?: string; // For edit mode
}

export default function PermissionCheckboxes({
  role,
  selectedPermissions,
  onChange,
  userId,
}: PermissionCheckboxesProps) {
  const [allPermissions, setAllPermissions] = useState<Record<string, Permission[]>>({});
  const [roleTemplate, setRoleTemplate] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [previousRole, setPreviousRole] = useState<string>('');

  // Load all permissions
  useEffect(() => {
    loadPermissions();
  }, []);

  // Load role template when role changes
  useEffect(() => {
    if (role) {
      loadRoleTemplate(role);
    }
  }, [role]);

  const loadPermissions = async () => {
    try {
      const res = await fetch('/api/permissions');
      const data = await res.json();
      if (data.success) {
        setAllPermissions(data.permissions);
      }
    } catch (error) {
      console.error('Load permissions error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoleTemplate = async (roleValue: string) => {
    try {
      const res = await fetch(`/api/permissions/role/${roleValue}`);
      const data = await res.json();
      if (data.success) {
        setRoleTemplate(data.permissions);
        
        // Auto-fill with role template when:
        // 1. No selections yet (create mode), OR
        // 2. Role changed (user switched role dropdown)
        const isRoleChanged = previousRole && previousRole !== roleValue;
        const shouldAutoFill = selectedPermissions.length === 0 || isRoleChanged;
        
        if (shouldAutoFill) {
          // Confirm if role changed and user has custom permissions
          if (isRoleChanged && selectedPermissions.length > 0) {
            if (confirm(`Change permissions to ${roleValue} template? Your current selections will be replaced.`)) {
              onChange(data.permissions);
            }
          } else {
            onChange(data.permissions);
          }
        }
        
        setPreviousRole(roleValue);
      }
    } catch (error) {
      console.error('Load role template error:', error);
    }
  };

  const handleToggle = (permissionKey: string) => {
    const newPerms = selectedPermissions.includes(permissionKey)
      ? selectedPermissions.filter((p) => p !== permissionKey)
      : [...selectedPermissions, permissionKey];
    onChange(newPerms);
  };

  const handleCategoryToggle = (category: string) => {
    const categoryPerms = allPermissions[category]?.map((p) => p.key) || [];
    const allSelected = categoryPerms.every((key) => selectedPermissions.includes(key));

    if (allSelected) {
      // Uncheck all in category
      onChange(selectedPermissions.filter((p) => !categoryPerms.includes(p)));
    } else {
      // Check all in category
      const newPerms = [...new Set([...selectedPermissions, ...categoryPerms])];
      onChange(newPerms);
    }
  };

  const handleResetToTemplate = () => {
    if (confirm('Reset permissions to role template?')) {
      onChange(roleTemplate);
    }
  };

  const handleSelectAll = () => {
    const allKeys = Object.values(allPermissions)
      .flat()
      .map((p) => p.key);
    onChange(allKeys);
  };

  const handleClearAll = () => {
    if (confirm('Clear all permissions?')) {
      onChange([]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-400">Loading permissions...</div>
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      DASHBOARD: '📊',
      USERS: '👥',
      CUSTOMERS: '👤',
      INVOICES: '💰',
      REGISTRATIONS: '📝',
      NETWORK: '🌐',
      HOTSPOT: '📡',
      REPORTS: '📈',
      KEUANGAN: '💵',
      WHATSAPP: '💬',
      NOTIFICATIONS: '🔔',
      SETTINGS: '⚙️',
    };
    return icons[category] || '📋';
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-1">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedPermissions.length} / {Object.values(allPermissions).flat().length} selected
          </div>
          {roleTemplate.length > 0 && (
            <div className="text-xs text-purple-600 dark:text-purple-400">
              ✓ {roleTemplate.length} permissions in role template
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleResetToTemplate}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Reset to Template
          </button>
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded transition"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded transition"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Permission Categories */}
      <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2">
        {Object.entries(allPermissions).map(([category, permissions]) => {
          const categoryPerms = permissions.map((p) => p.key);
          const allChecked = categoryPerms.every((key) => selectedPermissions.includes(key));
          const someChecked = categoryPerms.some((key) => selectedPermissions.includes(key));

          return (
            <div
              key={category}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Category Header */}
              <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => handleCategoryToggle(category)}
                  className="w-full flex items-center justify-between text-left hover:opacity-80 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryIcon(category)}</span>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                      {category}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({categoryPerms.filter((k) => selectedPermissions.includes(k)).length} / {categoryPerms.length})
                    </span>
                  </div>
                  {allChecked ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  ) : someChecked ? (
                    <Square className="w-4 h-4 text-gray-400 fill-blue-200 dark:fill-blue-900" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Permissions */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {permissions.map((permission) => {
                  const isChecked = selectedPermissions.includes(permission.key);
                  const isInTemplate = roleTemplate.includes(permission.key);

                  return (
                    <label
                      key={permission.key}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        isChecked
                          ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(permission.key)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {permission.name}
                          </span>
                          {isInTemplate && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                              Template
                            </span>
                          )}
                        </div>
                        {permission.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {permission.description}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
