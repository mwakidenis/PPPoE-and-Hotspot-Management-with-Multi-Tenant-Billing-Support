'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, Check, X, Code } from 'lucide-react';
import { renderVoucherTemplate, getPrintableHtml } from '@/lib/utils/templateRenderer';

// Default template
const DEFAULT_TEMPLATE = `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->
{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<!-- don't include opening body tag -->
<!-- START CUSTOM HTML -->
<!-- ############################# -->

<table style="display: inline-block; width: 188px; border: 1px solid #e0e0e0; border-collapse: collapse; font-family: Arial, sans-serif; margin: 3px; vertical-align: top;">
<tr>
<td style="padding: 0;">
<!-- Header -->
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="background: linear-gradient(to bottom, #ffd700, #ffed4e); color: #333; text-align: center; padding: 4px 0; font-size: 10px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">
{if $vs['code'] eq $vs['secret']}
Voucher Code
{else}
Username / Password
{/if}
</td>
</tr>
</table>

<!-- Content -->
{if $vs['code'] eq $vs['secret']}
<!-- Single Voucher Code -->
<table style="width: 100%; background: #e6f7ff; border-collapse: collapse;">
<tr>
<td style="text-align: center; padding: 12px 8px;">
<div style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; color: #0066cc; letter-spacing: 1px;">
{$vs['code']}
</div>
</td>
</tr>
</table>
{else}
<!-- Username and Password -->
<table style="width: 100%; background: #e6f7ff; border-collapse: collapse;">
<tr>
<td style="width: 50%; text-align: center; padding: 2px; font-size: 9px; color: #666;">
Username
</td>
<td style="width: 50%; text-align: center; padding: 2px; font-size: 9px; color: #666;">
Password 
</td>
</tr>
<tr>
<td style="text-align: center; padding: 8px 4px; border-right: 1px solid #d0d0d0;">
<div style="font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; color: #0066cc;">
{$vs['code']}
</div>
</td>
<td style="text-align: center; padding: 8px 4px;">
<div style="font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; color: #0066cc;">
{$vs['secret']}
</div>
</td>
</tr>
</table>
{/if}

<!-- Footer -->
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="background: #f0f0f0; text-align: center; padding: 6px 0; font-size: 11px; color: #333; border-top: 1px solid #e0e0e0;">
AIBILL - {$_c['currency_code']}. {number_format($vs['total'], 0, ',', '.')}
</td>
</tr>
</table>
</td>
</tr>
</table>

<!-- ############################# -->
<!-- END CUSTOM HTML -->
<!-- don't include closing body tag -->
{/foreach} <!-- DON'T REMOVE THIS LINE -->
{include file="rad-template-footer.tpl"} <!-- DON'T REMOVE THIS LINE -->`;

interface VoucherTemplate {
  id: string;
  name: string;
  htmlTemplate: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function VoucherTemplatesPage() {
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<VoucherTemplate | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    htmlTemplate: DEFAULT_TEMPLATE,
    isDefault: false,
    isActive: true
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/voucher-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingTemplate 
        ? `/api/voucher-templates/${editingTemplate.id}`
        : '/api/voucher-templates';
      
      const method = editingTemplate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        await showSuccess(editingTemplate ? 'Template updated successfully' : 'Template created successfully');
        await fetchTemplates();
        handleCloseDialog();
      } else {
        const error = await res.json();
        await showError(error.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Save error:', error);
      await showError('Failed to save template');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm('Are you sure you want to delete this template?');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/voucher-templates/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await showSuccess('Template deleted successfully');
        await fetchTemplates();
      } else {
        const error = await res.json();
        await showError(error.error || 'Failed to delete template');
      }
    } catch (error) {
      console.error('Delete error:', error);
      await showError('Failed to delete template');
    }
  };

  const handleEdit = (template: VoucherTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      htmlTemplate: template.htmlTemplate,
      isDefault: template.isDefault,
      isActive: template.isActive
    });
    setShowDialog(true);
  };

  const handleAdd = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      htmlTemplate: DEFAULT_TEMPLATE,
      isDefault: false,
      isActive: true
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingTemplate(null);
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  // Sample vouchers for preview
  const sampleVouchers = [
    { code: 'DEMO1234', secret: 'DEMO1234', total: 10000 },
    { code: 'USER5678', secret: 'PASS5678', total: 25000 }
  ];

  const previewHtml = renderVoucherTemplate(
    formData.htmlTemplate,
    sampleVouchers,
    { currencyCode: 'Rp', companyName: 'AIBILL' }
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Voucher Templates
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage voucher print templates
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Default
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {templates.map((template) => (
                <tr key={template.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      template.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {template.isDefault && (
                      <Check className="h-5 w-5 text-green-500" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(template)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No templates found. Create your first template!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingTemplate ? 'Edit Template' : 'Add Template'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Default Card, Modern Blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    HTML Template
                  </label>
                  <textarea
                    value={formData.htmlTemplate}
                    onChange={(e) => setFormData({ ...formData, htmlTemplate: e.target.value })}
                    required
                    rows={20}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                    placeholder="Enter HTML template code..."
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use Smarty syntax: {`{$vs['code']}, {$vs['secret']}, {$vs['total']}, {$_c['currency_code']}`}
                  </p>
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Set as Default
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Active
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="flex items-center px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </button>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleCloseDialog}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingTemplate ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Template Preview
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
