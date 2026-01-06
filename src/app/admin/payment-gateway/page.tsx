'use client';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  CreditCard, 
  Wallet, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  List,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface PaymentGateway {
  id: string;
  provider: string;
  name: string;
  isActive: boolean;
  midtransClientKey?: string | null;
  midtransServerKey?: string | null;
  midtransEnvironment: string;
  xenditApiKey?: string | null;
  xenditWebhookToken?: string | null;
  xenditEnvironment: string;
  duitkuMerchantCode?: string | null;
  duitkuApiKey?: string | null;
  duitkuEnvironment: string;
}

interface WebhookLog {
  id: string;
  gateway: string;
  orderId: string;
  status: string;
  transactionId: string | null;
  amount: number | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  payload: string | null;
  response: string | null;
}

export default function PaymentGatewayPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<PaymentGateway[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  
  // Webhook logs state
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsFilter, setLogsFilter] = useState({ gateway: '', orderId: '', success: '' });
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const [midtransForm, setMidtransForm] = useState({
    clientKey: '',
    serverKey: '',
    environment: 'sandbox',
    isActive: false
  });

  const [xenditForm, setXenditForm] = useState({
    apiKey: '',
    webhookToken: '',
    environment: 'sandbox',
    isActive: false
  });

  const [duitkuForm, setDuitkuForm] = useState({
    merchantCode: '',
    apiKey: '',
    environment: 'sandbox',
    isActive: false
  });

  useEffect(() => {
    fetchConfigs();
    fetchWebhookLogs();
  }, []);
  
  useEffect(() => {
    fetchWebhookLogs();
  }, [logsPage, logsFilter]);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/payment-gateway/config');
      const data = await res.json();
      
      setConfigs(data);
      
      // Populate forms
      const midtrans = data.find((c: PaymentGateway) => c.provider === 'midtrans');
      if (midtrans) {
        setMidtransForm({
          clientKey: midtrans.midtransClientKey || '',
          serverKey: midtrans.midtransServerKey || '',
          environment: midtrans.midtransEnvironment || 'sandbox',
          isActive: midtrans.isActive
        });
      }

      const xendit = data.find((c: PaymentGateway) => c.provider === 'xendit');
      if (xendit) {
        setXenditForm({
          apiKey: xendit.xenditApiKey || '',
          webhookToken: xendit.xenditWebhookToken || '',
          environment: xendit.xenditEnvironment || 'sandbox',
          isActive: xendit.isActive
        });
      }

      const duitku = data.find((c: PaymentGateway) => c.provider === 'duitku');
      if (duitku) {
        setDuitkuForm({
          merchantCode: duitku.duitkuMerchantCode || '',
          apiKey: duitku.duitkuApiKey || '',
          environment: duitku.duitkuEnvironment || 'sandbox',
          isActive: duitku.isActive
        });
      }
    } catch (error) {
      console.error('Fetch configs error:', error);
      await showError('Failed to load payment gateway configs');
    } finally {
      setLoading(false);
    }
  };

  const saveMidtrans = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payment-gateway/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'midtrans',
          midtransClientKey: midtransForm.clientKey,
          midtransServerKey: midtransForm.serverKey,
          midtransEnvironment: midtransForm.environment,
          isActive: midtransForm.isActive
        })
      });

      if (res.ok) {
        await showSuccess('Midtrans configuration saved successfully');
        fetchConfigs();
      } else {
        const data = await res.json();
        await showError(data.error || 'Failed to save Midtrans config');
      }
    } catch (error) {
      console.error('Save Midtrans error:', error);
      await showError('Failed to save Midtrans configuration');
    } finally {
      setSaving(false);
    }
  };

  const saveXendit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payment-gateway/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'xendit',
          xenditApiKey: xenditForm.apiKey,
          xenditWebhookToken: xenditForm.webhookToken,
          xenditEnvironment: xenditForm.environment,
          isActive: xenditForm.isActive
        })
      });

      if (res.ok) {
        await showSuccess('Xendit configuration saved successfully');
        fetchConfigs();
      } else {
        const data = await res.json();
        await showError(data.error || 'Failed to save Xendit config');
      }
    } catch (error) {
      console.error('Save Xendit error:', error);
      await showError('Failed to save Xendit configuration');
    } finally {
      setSaving(false);
    }
  };

  const saveDuitku = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payment-gateway/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'duitku',
          duitkuMerchantCode: duitkuForm.merchantCode,
          duitkuApiKey: duitkuForm.apiKey,
          duitkuEnvironment: duitkuForm.environment,
          isActive: duitkuForm.isActive
        })
      });

      if (res.ok) {
        await showSuccess('Duitku configuration saved successfully');
        fetchConfigs();
      } else {
        const data = await res.json();
        await showError(data.error || 'Failed to save Duitku config');
      }
    } catch (error) {
      console.error('Save Duitku error:', error);
      await showError('Failed to save Duitku configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyWebhookUrl = async () => {
    const webhookUrl = `${window.location.origin}/api/payment/webhook`;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied('webhook');
      await showToast('Webhook URL copied!', 'success');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      await showError('Failed to copy webhook URL');
    }
  };
  
  const fetchWebhookLogs = async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({
        page: logsPage.toString(),
        limit: '20'
      });
      
      if (logsFilter.gateway) params.append('gateway', logsFilter.gateway);
      if (logsFilter.orderId) params.append('orderId', logsFilter.orderId);
      if (logsFilter.success) params.append('success', logsFilter.success);
      
      const res = await fetch(`/api/payment-gateway/webhook-logs?${params}`);
      const data = await res.json();
      
      if (res.ok) {
        setWebhookLogs(data.logs);
        setLogsTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch webhook logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };
  
  const formatTimestamp = (timestamp: string) => {
    return formatWIB(new Date(timestamp), 'dd MMM yyyy HH:mm:ss');
  };
  
  const formatAmount = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const midtransActive = configs.find(c => c.provider === 'midtrans')?.isActive;
  const xenditActive = configs.find(c => c.provider === 'xendit')?.isActive;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Payment Gateway
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage payment gateway integrations
        </p>
      </div>

      {/* Webhook URL Card */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Webhook Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              Set this URL in your payment gateway dashboard:
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/payment/webhook`}
                readOnly
                className="font-mono text-sm bg-white dark:bg-gray-900"
              />
              <Button
                onClick={copyWebhookUrl}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                {copied === 'webhook' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ✅ This single URL works for both Midtrans & Xendit webhooks
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gateway Tabs */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Webhook Logs
          </TabsTrigger>
          <TabsTrigger value="midtrans" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Midtrans
            {midtransActive && <CheckCircle2 className="h-3 w-3 text-green-600" />}
          </TabsTrigger>
          <TabsTrigger value="xendit" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Xendit
            {xenditActive && <CheckCircle2 className="h-3 w-3 text-green-600" />}
          </TabsTrigger>
          <TabsTrigger value="duitku" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Duitku
            {configs.find(c => c.provider === 'duitku')?.isActive && <CheckCircle2 className="h-3 w-3 text-green-600" />}
          </TabsTrigger>
        </TabsList>

        {/* MIDTRANS */}
        <TabsContent value="midtrans">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Midtrans Configuration</CardTitle>
                  <CardDescription>
                    Configure your Midtrans Snap payment gateway
                  </CardDescription>
                </div>
                {midtransActive && (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Environment */}
              <div className="space-y-2">
                <Label>Environment</Label>
                <select
                  value={midtransForm.environment}
                  onChange={(e) => setMidtransForm({ ...midtransForm, environment: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production</option>
                </select>
              </div>

              {/* Client Key */}
              <div className="space-y-2">
                <Label>Client Key</Label>
                <div className="relative">
                  <Input
                    type={showSecrets['midtrans-client'] ? 'text' : 'password'}
                    value={midtransForm.clientKey}
                    onChange={(e) => setMidtransForm({ ...midtransForm, clientKey: e.target.value })}
                    placeholder="SB-Mid-client-xxxxx or Mid-client-xxxxx"
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecret('midtrans-client')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSecrets['midtrans-client'] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Server Key */}
              <div className="space-y-2">
                <Label>Server Key</Label>
                <div className="relative">
                  <Input
                    type={showSecrets['midtrans-server'] ? 'text' : 'password'}
                    value={midtransForm.serverKey}
                    onChange={(e) => setMidtransForm({ ...midtransForm, serverKey: e.target.value })}
                    placeholder="SB-Mid-server-xxxxx or Mid-server-xxxxx"
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecret('midtrans-server')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSecrets['midtrans-server'] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-base">Enable Midtrans</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Make Midtrans available for customers
                  </p>
                </div>
                <Switch
                  checked={midtransForm.isActive}
                  onCheckedChange={(checked) => setMidtransForm({ ...midtransForm, isActive: checked })}
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={saveMidtrans}
                disabled={saving || !midtransForm.clientKey || !midtransForm.serverKey}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Midtrans Configuration
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* XENDIT */}
        <TabsContent value="xendit">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Xendit Configuration</CardTitle>
                  <CardDescription>
                    Configure your Xendit payment gateway
                  </CardDescription>
                </div>
                {xenditActive && (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Environment */}
              <div className="space-y-2">
                <Label>Environment</Label>
                <select
                  value={xenditForm.environment}
                  onChange={(e) => setXenditForm({ ...xenditForm, environment: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production</option>
                </select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label>API Key (Secret Key)</Label>
                <div className="relative">
                  <Input
                    type={showSecrets['xendit-api'] ? 'text' : 'password'}
                    value={xenditForm.apiKey}
                    onChange={(e) => setXenditForm({ ...xenditForm, apiKey: e.target.value })}
                    placeholder="xnd_development_xxxxx or xnd_production_xxxxx"
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecret('xendit-api')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSecrets['xendit-api'] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Webhook Token */}
              <div className="space-y-2">
                <Label>Webhook Token (Optional)</Label>
                <div className="relative">
                  <Input
                    type={showSecrets['xendit-webhook'] ? 'text' : 'password'}
                    value={xenditForm.webhookToken}
                    onChange={(e) => setXenditForm({ ...xenditForm, webhookToken: e.target.value })}
                    placeholder="Optional verification token"
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecret('xendit-webhook')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSecrets['xendit-webhook'] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Set this in Xendit Dashboard → Settings → Webhooks → Verification Token
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-base">Enable Xendit</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Make Xendit available for customers
                  </p>
                </div>
                <Switch
                  checked={xenditForm.isActive}
                  onCheckedChange={(checked) => setXenditForm({ ...xenditForm, isActive: checked })}
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={saveXendit}
                disabled={saving || !xenditForm.apiKey}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Xendit Configuration
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DUITKU CONFIGURATION */}
        <TabsContent value="duitku">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Duitku Configuration</CardTitle>
                  <CardDescription>
                    Configure your Duitku payment gateway
                  </CardDescription>
                </div>
                {configs.find(c => c.provider === 'duitku')?.isActive && (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Environment */}
              <div className="space-y-2">
                <Label>Environment</Label>
                <select
                  value={duitkuForm.environment}
                  onChange={(e) => setDuitkuForm({ ...duitkuForm, environment: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production</option>
                </select>
              </div>

              {/* Merchant Code */}
              <div className="space-y-2">
                <Label>Merchant Code</Label>
                <Input
                  type="text"
                  value={duitkuForm.merchantCode}
                  onChange={(e) => setDuitkuForm({ ...duitkuForm, merchantCode: e.target.value })}
                  placeholder="D1234"
                  className="font-mono text-sm"
                />
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showSecrets['duitku-api'] ? 'text' : 'password'}
                    value={duitkuForm.apiKey}
                    onChange={(e) => setDuitkuForm({ ...duitkuForm, apiKey: e.target.value })}
                    placeholder="Your Duitku API Key"
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecret('duitku-api')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSecrets['duitku-api'] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-base">Enable Duitku</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Make Duitku available for customers
                  </p>
                </div>
                <Switch
                  checked={duitkuForm.isActive}
                  onCheckedChange={(checked) => setDuitkuForm({ ...duitkuForm, isActive: checked })}
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={saveDuitku}
                disabled={saving || !duitkuForm.merchantCode || !duitkuForm.apiKey}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Duitku Configuration
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* WEBHOOK LOGS */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Webhook History</CardTitle>
                  <CardDescription>
                    Track all payment webhook callbacks
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => fetchWebhookLogs()} 
                  size="sm" 
                  variant="outline"
                  disabled={logsLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Gateway</Label>
                  <select
                    value={logsFilter.gateway}
                    onChange={(e) => {
                      setLogsFilter({ ...logsFilter, gateway: e.target.value });
                      setLogsPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="">All Gateways</option>
                    <option value="midtrans">Midtrans</option>
                    <option value="xendit">Xendit</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Order ID</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={logsFilter.orderId}
                      onChange={(e) => {
                        setLogsFilter({ ...logsFilter, orderId: e.target.value });
                        setLogsPage(1);
                      }}
                      placeholder="Search order ID..."
                      className="pl-9 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <select
                    value={logsFilter.success}
                    onChange={(e) => {
                      setLogsFilter({ ...logsFilter, success: e.target.value });
                      setLogsPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="">All Status</option>
                    <option value="true">Success</option>
                    <option value="false">Failed</option>
                  </select>
                </div>
              </div>
              
              {/* Logs Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Time</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Gateway</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Order ID</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Amount</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Result</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-800">
                      {logsLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                          </td>
                        </tr>
                      ) : webhookLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            No webhook logs found
                          </td>
                        </tr>
                      ) : (
                        webhookLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                              {formatTimestamp(log.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-xs">
                                {log.gateway}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {log.orderId}
                            </td>
                            <td className="px-4 py-3">
                              <Badge 
                                variant="outline"
                                className={`text-xs ${
                                  log.status === 'settlement' 
                                    ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20' 
                                    : log.status === 'pending'
                                    ? 'border-yellow-300 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
                                    : 'border-red-300 text-red-700 bg-red-50 dark:bg-red-900/20'
                                }`}
                              >
                                {log.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {formatAmount(log.amount)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {log.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-600 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                onClick={() => setSelectedLog(log)}
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                              >
                                View
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Pagination */}
              {logsTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Page {logsPage} of {logsTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                      disabled={logsPage === 1 || logsLoading}
                      size="sm"
                      variant="outline"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
                      disabled={logsPage === logsTotalPages || logsLoading}
                      size="sm"
                      variant="outline"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Log Detail Modal */}
          {selectedLog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedLog(null)}>
              <Card className="max-w-3xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Webhook Log Details</CardTitle>
                    <Button onClick={() => setSelectedLog(null)} size="sm" variant="ghost">
                      ✕
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 overflow-y-auto max-h-[70vh]">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-gray-500">Timestamp</Label>
                      <p className="font-medium">{formatTimestamp(selectedLog.createdAt)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Gateway</Label>
                      <p className="font-medium capitalize">{selectedLog.gateway}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Order ID</Label>
                      <p className="font-mono text-xs">{selectedLog.orderId}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Transaction ID</Label>
                      <p className="font-mono text-xs">{selectedLog.transactionId || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Status</Label>
                      <p className="font-medium">{selectedLog.status}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Amount</Label>
                      <p className="font-medium">{formatAmount(selectedLog.amount)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Success</Label>
                      <p className="font-medium">{selectedLog.success ? '✅ Yes' : '❌ No'}</p>
                    </div>
                    {selectedLog.errorMessage && (
                      <div className="col-span-2">
                        <Label className="text-xs text-red-500">Error Message</Label>
                        <p className="text-red-600 font-mono text-xs mt-1">{selectedLog.errorMessage}</p>
                      </div>
                    )}
                  </div>
                  
                  {selectedLog.payload && (
                    <div>
                      <Label className="text-xs text-gray-500 mb-2 block">Webhook Payload</Label>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(JSON.parse(selectedLog.payload), null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {selectedLog.response && (
                    <div>
                      <Label className="text-xs text-gray-500 mb-2 block">Response</Label>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(JSON.parse(selectedLog.response), null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
