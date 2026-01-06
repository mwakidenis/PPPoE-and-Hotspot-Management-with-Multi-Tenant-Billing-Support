'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Copy,
  Info,
  MessageSquare,
  Loader2,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { showSuccess, showError } from '@/lib/sweetalert';

interface Template {
  id: string;
  name: string;
  type: string;
  message: string;
  isActive: boolean;
}

const templateConfig = {
  'registration-approval': {
    title: '🎉 Persetujuan Pendaftaran',
    description: 'Dikirim saat admin menyetujui pendaftaran customer baru',
    variables: [
      '{{customerName}}',
      '{{username}}',
      '{{password}}',
      '{{profileName}}',
      '{{installationFee}}',
      '{{companyName}}',
      '{{companyPhone}}',
    ],
  },
  'admin-create-user': {
    title: '👤 Admin Create User',
    description: 'Dikirim saat admin membuat user manual (tanpa flow registrasi)',
    variables: [
      '{{customerName}}',
      '{{username}}',
      '{{password}}',
      '{{profileName}}',
      '{{companyName}}',
      '{{companyPhone}}',
    ],
  },
  'installation-invoice': {
    title: '🔧 Invoice Instalasi',
    description: 'Dikirim saat instalasi selesai dan invoice dibuat',
    variables: [
      '{{customerName}}',
      '{{invoiceNumber}}',
      '{{amount}}',
      '{{dueDate}}',
      '{{paymentLink}}',
      '{{companyName}}',
      '{{companyPhone}}',
    ],
  },
  'invoice-reminder': {
    title: '📅 Invoice Bulanan / Jatuh Tempo',
    description: 'Dikirim via cron untuk invoice bulanan yang mendekati jatuh tempo',
    variables: [
      '{{customerName}}',
      '{{username}}',
      '{{invoiceNumber}}',
      '{{amount}}',
      '{{dueDate}}',
      '{{daysRemaining}}',
      '{{paymentLink}}',
      '{{companyName}}',
      '{{companyPhone}}',
    ],
  },
  'payment-success': {
    title: '✅ Pembayaran Berhasil',
    description: 'Dikirim otomatis saat pembayaran invoice berhasil',
    variables: [
      '{{customerName}}',
      '{{username}}',
      '{{password}}',
      '{{profileName}}',
      '{{invoiceNumber}}',
      '{{amount}}',
      '{{companyName}}',
      '{{companyPhone}}',
    ],
  },
  'maintenance-outage': {
    title: '⚠️ Informasi Gangguan',
    description: 'Template untuk broadcast informasi maintenance atau gangguan jaringan',
    variables: [
      '{{customerName}}',
      '{{username}}',
      '{{issueType}}',
      '{{description}}',
      '{{estimatedTime}}',
      '{{affectedArea}}',
      '{{companyName}}',
      '{{companyPhone}}',
    ],
  },
};

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();

      if (data.success) {
        const templatesMap: Record<string, Template> = {};
        data.data.forEach((t: Template) => {
          templatesMap[t.type] = t;
        });
        setTemplates(templatesMap);
        
        // If no templates exist, show info to user
        if (data.data.length === 0) {
          console.log('No templates found, defaults will be created on save');
        }
      }
    } catch (error) {
      console.error('Fetch templates error:', error);
      showError('Gagal memuat template');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (type: string, message: string) => {
    const template = templates[type];
    if (!template) return;

    setSaving(type);
    try {
      const res = await fetch(`/api/whatsapp/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (data.success) {
        showSuccess('Template berhasil diupdate!');
        fetchTemplates();
      } else {
        showError(data.error || 'Gagal update template');
      }
    } catch (error) {
      console.error('Update template error:', error);
      showError('Gagal update template');
    } finally {
      setSaving(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Template berhasil dicopy!');
  };

  const TemplateEditor = ({ type }: { type: string }) => {
    const template = templates[type];
    const config = templateConfig[type as keyof typeof templateConfig];
    const [message, setMessage] = useState(template?.message || '');

    useEffect(() => {
      setMessage(template?.message || '');
    }, [template]);

    if (!config) return null;

    const isChanged = template && message !== template.message;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {config.title}
                {template && (
                  <Badge variant={template.isActive ? 'default' : 'secondary'} className="text-xs">
                    {template.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">{config.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!template ? (
            <div className="text-center py-8 text-gray-400">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Template belum dibuat</p>
              <p className="text-xs mt-1">Buat template default atau tambah manual</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Template Pesan
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="font-mono text-sm min-h-[300px]"
                  placeholder="Tulis template WhatsApp Anda di sini..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {message.length} karakter
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  <label className="text-sm font-medium">Variabel Tersedia</label>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex flex-wrap gap-2">
                    {config.variables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => {
                          const textarea = document.querySelector(`textarea`) as HTMLTextAreaElement;
                          if (textarea) {
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const newText = message.slice(0, start) + variable + message.slice(end);
                            setMessage(newText);
                            setTimeout(() => {
                              textarea.selectionStart = textarea.selectionEnd = start + variable.length;
                              textarea.focus();
                            }, 0);
                          }
                        }}
                        className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-md font-mono transition-colors"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    💡 Klik variabel untuk menambahkan ke posisi kursor
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border">
                <p className="text-xs font-medium mb-2">Format WhatsApp:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div>• *bold* → <strong>bold</strong></div>
                  <div>• _italic_ → <em>italic</em></div>
                  <div>• ~strikethrough~ → <del>strikethrough</del></div>
                  <div>• ```code``` → <code>code</code></div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleUpdate(type, message)}
                  className="flex-1"
                  disabled={!isChanged || saving === type}
                >
                  {saving === type ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : isChanged ? (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Simpan Perubahan
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Tersimpan
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => copyToClipboard(message)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          WhatsApp Templates
        </h1>
        <p className="text-gray-500 mt-1">
          Edit template notifikasi WhatsApp untuk customer
        </p>
      </div>

      <Tabs defaultValue="registration-approval" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="registration-approval">
            🎉 Persetujuan
          </TabsTrigger>
          <TabsTrigger value="admin-create-user">
            👤 Admin Create
          </TabsTrigger>
          <TabsTrigger value="installation-invoice">
            🔧 Instalasi
          </TabsTrigger>
          <TabsTrigger value="invoice-reminder">
            📅 Jatuh Tempo
          </TabsTrigger>
          <TabsTrigger value="payment-success">
            ✅ Pembayaran
          </TabsTrigger>
          <TabsTrigger value="maintenance-outage">
            ⚠️ Gangguan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registration-approval" className="mt-4">
          <TemplateEditor type="registration-approval" />
        </TabsContent>

        <TabsContent value="admin-create-user" className="mt-4">
          <TemplateEditor type="admin-create-user" />
        </TabsContent>

        <TabsContent value="installation-invoice" className="mt-4">
          <TemplateEditor type="installation-invoice" />
        </TabsContent>

        <TabsContent value="invoice-reminder" className="mt-4">
          <TemplateEditor type="invoice-reminder" />
        </TabsContent>

        <TabsContent value="payment-success" className="mt-4">
          <TemplateEditor type="payment-success" />
        </TabsContent>

        <TabsContent value="maintenance-outage" className="mt-4">
          <TemplateEditor type="maintenance-outage" />
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                📋 Cara Penggunaan Template
              </p>
              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <li>
                  • <strong>Persetujuan Pendaftaran</strong>: Dikirim saat admin approve registrasi baru
                </li>
                <li>
                  • <strong>Admin Create User</strong>: Dikirim saat admin create user manual (tanpa flow registrasi)
                </li>
                <li>
                  • <strong>Invoice Instalasi</strong>: Dikirim saat mark installed dan invoice dibuat
                </li>
                <li>
                  • <strong>Invoice Jatuh Tempo</strong>: Dikirim via cron untuk reminder invoice bulanan (H-5, H-3, H-1, H-0)
                </li>
                <li>
                  • <strong>Pembayaran Berhasil</strong>: Dikirim otomatis saat invoice dibayar
                </li>
                <li>
                  • <strong>Informasi Gangguan</strong>: Template untuk broadcast maintenance/gangguan (manual via halaman Send/Broadcast)
                </li>
                <li>
                  • Variabel <code>{'{{nama}}'}</code> akan diganti otomatis dengan data real
                </li>
                <li>
                  • Gunakan format WhatsApp untuk styling (bold, italic, dll)
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
