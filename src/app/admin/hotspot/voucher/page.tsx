"use client"
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatToWIB, formatDateOnly, formatTimeOnly, calculateTimeLeft } from "@/lib/utils/dateUtils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Loader2, Trash2, Ticket, Printer, Check, Download, Upload, FileSpreadsheet, MessageCircle } from "lucide-react"
import { renderVoucherTemplate, getPrintableHtml } from '@/lib/utils/templateRenderer'

interface Voucher {
  id: string
  code: string
  batchCode: string | null
  status: 'WAITING' | 'ACTIVE' | 'EXPIRED'
  firstLoginAt: string | null
  expiresAt: string | null
  lastUsedBy: string | null
  createdAt: string
  profile: {
    name: string
    sellingPrice: number
    validityValue: number
    validityUnit: string
  }
}

interface Profile {
  id: string
  name: string
  sellingPrice: number
}

export default function HotspotVoucherPage() {
  const [loading, setLoading] = useState(true)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [batches, setBatches] = useState<string[]>([])
  
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleteBatchCode, setDeleteBatchCode] = useState<string | null>(null)
  
  // Print functionality
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([])
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  
  // WhatsApp functionality
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)

  // Filters
  const [filterProfile, setFilterProfile] = useState<string>("")
  const [filterBatch, setFilterBatch] = useState<string>("")
  const [filterStatus, setFilterStatus] = useState<string>("")
  
  // Import/Export states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importProfileId, setImportProfileId] = useState('')
  const [importBatchCode, setImportBatchCode] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  const [formData, setFormData] = useState({
    quantity: "",
    profileId: "",
    codeLength: "6",
    prefix: "",
  })

  useEffect(() => {
    loadProfiles()
    loadVouchers()
    loadTemplates()
  }, [])

  useEffect(() => {
    loadVouchers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProfile, filterBatch, filterStatus])

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/hotspot/profiles')
      const data = await res.json()
      setProfiles(data.profiles || [])
    } catch (error) {
      console.error('Load profiles error:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/voucher-templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.filter((t: any) => t.isActive))
        // Set default template
        const defaultTemplate = data.find((t: any) => t.isDefault)
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id)
        }
      }
    } catch (error) {
      console.error('Load templates error:', error)
    }
  }

  const loadVouchers = async () => {
    try {
      const params = new URLSearchParams()
      if (filterProfile && filterProfile !== 'all') params.append('profileId', filterProfile)
      if (filterBatch && filterBatch !== 'all') params.append('batchCode', filterBatch)
      if (filterStatus && filterStatus !== 'all') params.append('status', filterStatus)

      const res = await fetch(`/api/hotspot/voucher?${params}`)
      const data = await res.json()
      setVouchers(data.vouchers || [])
      setBatches(data.batches || [])
    } catch (error) {
      console.error('Load vouchers error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)

    try {
      const res = await fetch('/api/hotspot/voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (res.ok) {
        await showSuccess(`Success! ${data.count} vouchers generated\nBatch Code: ${data.batchCode}`);
        setIsGenerateDialogOpen(false)
        setFormData({
          quantity: "",
          profileId: "",
          codeLength: "6",
          prefix: "",
        })
        loadVouchers()
      } else {
        await showError('Failed: ' + data.error);
      }
    } catch (error) {
      console.error('Generate vouchers error:', error)
      await showError('Failed to generate vouchers');
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteBatch = async () => {
    if (!deleteBatchCode) return
    
    const confirmed = await showConfirm(`Delete all unused vouchers from batch ${deleteBatchCode}?`);
    if (!confirmed) {
      setDeleteBatchCode(null);
      return;
    }

    try {
      const res = await fetch(`/api/hotspot/voucher?batchCode=${deleteBatchCode}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (res.ok) {
        await showSuccess(`${data.count} unused vouchers deleted from batch`);
        loadVouchers()
      } else {
        await showError('Failed: ' + data.error);
      }
    } catch (error) {
      console.error('Delete batch error:', error)
      await showError('Failed to delete batch');
    } finally {
      setDeleteBatchCode(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const handleSelectVoucher = (voucherId: string) => {
    setSelectedVouchers(prev => 
      prev.includes(voucherId) 
        ? prev.filter(id => id !== voucherId)
        : [...prev, voucherId]
    )
  }

  const handleSelectAll = () => {
    const waitingVouchers = vouchers.filter(v => v.status === 'WAITING').map(v => v.id)
    setSelectedVouchers(waitingVouchers.length === selectedVouchers.length ? [] : waitingVouchers)
  }

  const handlePrintSelected = async () => {
    if (selectedVouchers.length === 0) {
      await showError('Please select vouchers to print');
      return
    }
    setIsPrintDialogOpen(true)
  }
  
  const handleSendWhatsApp = async () => {
    if (selectedVouchers.length === 0) {
      await showError('Please select vouchers to send');
      return
    }
    setIsWhatsAppDialogOpen(true)
  }
  
  const handleWhatsAppSubmit = async () => {
    if (!whatsappPhone) {
      await showError('Please enter phone number');
      return
    }
    
    setSendingWhatsApp(true)
    try {
      const vouchersToSend = vouchers.filter(v => selectedVouchers.includes(v.id))
      
      const res = await fetch('/api/hotspot/voucher/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappPhone,
          vouchers: vouchersToSend.map(v => ({
            code: v.code,
            profileName: v.profile.name,
            price: v.profile.sellingPrice,
            validity: `${v.profile.validityValue} ${v.profile.validityUnit.toLowerCase()}`
          }))
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        await showSuccess(`WhatsApp sent successfully to ${whatsappPhone}!`)
        setIsWhatsAppDialogOpen(false)
        setWhatsappPhone('')
        setSelectedVouchers([])
      } else {
        await showError('Failed: ' + data.error)
      }
    } catch (error) {
      console.error('Send WhatsApp error:', error)
      await showError('Failed to send WhatsApp')
    } finally {
      setSendingWhatsApp(false)
    }
  }

  const handlePrintBatch = async () => {
    if (!filterBatch || filterBatch === 'all') {
      await showError('Please filter by batch first');
      return
    }
    // Select all vouchers in current batch
    const batchVouchers = vouchers.filter(v => v.batchCode === filterBatch && v.status === 'WAITING').map(v => v.id)
    setSelectedVouchers(batchVouchers)
    setIsPrintDialogOpen(true)
  }

  const handlePrint = async () => {
    if (!selectedTemplate) {
      await showError('Please select a template');
      return
    }

    const template = templates.find(t => t.id === selectedTemplate)
    if (!template) return

    const vouchersToPrint = vouchers.filter(v => selectedVouchers.includes(v.id))
    const voucherData = vouchersToPrint.map(v => ({
      code: v.code,
      secret: v.code, // For hotspot, code === secret
      total: v.profile.sellingPrice
    }))

    const rendered = renderVoucherTemplate(template.htmlTemplate, voucherData, {
      currencyCode: 'Rp',
      companyName: 'AIBILL'
    })

    const printHtml = getPrintableHtml(rendered)
    
    // Open print window
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printHtml)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }

    setIsPrintDialogOpen(false)
    setSelectedVouchers([])
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/hotspot/voucher/bulk?type=template')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hotspot-voucher-template.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download template error:', error)
      await showError('Failed to download template')
    }
  }

  const handleExportData = async () => {
    try {
      const res = await fetch('/api/hotspot/voucher/bulk?type=export')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hotspot-vouchers-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export data error:', error)
      await showError('Failed to export data')
    }
  }

  const handleImport = async () => {
    if (!importFile || !importProfileId) {
      await showError('Please select a file and profile')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('profileId', importProfileId)
      if (importBatchCode) formData.append('batchCode', importBatchCode)

      const res = await fetch('/api/hotspot/voucher/bulk', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setImportResult(data.results)
        loadVouchers()
        if (data.results.failed === 0) {
          setTimeout(() => {
            setIsImportDialogOpen(false)
            setImportFile(null)
            setImportProfileId('')
            setImportBatchCode('')
            setImportResult(null)
          }, 3000)
        }
      } else {
        await showError('Import failed: ' + data.error)
      }
    } catch (error) {
      console.error('Import error:', error)
      await showError('Import failed. Please check your file format.')
    } finally {
      setImporting(false)
    }
  }

  const selectedProfile = profiles.find(p => p.id === formData.profileId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  const stats = {
    total: vouchers.length,
    waiting: vouchers.filter(v => v.status === 'WAITING').length,
    active: vouchers.filter(v => v.status === 'ACTIVE').length,
    expired: vouchers.filter(v => v.status === 'EXPIRED').length,
    totalValue: vouchers.filter(v => v.status === 'WAITING').reduce((sum, v) => sum + Number(v.profile.sellingPrice), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Vouchers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate and manage hotspot vouchers (WIB)
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate Vouchers
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Vouchers</DialogTitle>
                <DialogDescription>
                  Create a batch of hotspot vouchers
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max="500"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="e.g., 100"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileId">Profile *</Label>
                  <Select
                    value={formData.profileId}
                    onValueChange={(value) => setFormData({ ...formData, profileId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} - {formatCurrency(profile.sellingPrice)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codeLength">Code Length (4-10) *</Label>
                  <Input
                    id="codeLength"
                    type="number"
                    min="4"
                    max="10"
                    value={formData.codeLength}
                    onChange={(e) => setFormData({ ...formData, codeLength: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefix (Optional)</Label>
                  <Input
                    id="prefix"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                    placeholder="e.g., HS-"
                    maxLength={5}
                  />
                </div>

                {selectedProfile && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Total Value:</strong> {formatCurrency(selectedProfile.sellingPrice * parseInt(formData.quantity || '0'))}
                    </p>
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={generating}>
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Vouchers
            </CardTitle>
            <Ticket className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Waiting
            </CardTitle>
            <Ticket className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.waiting}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Active
            </CardTitle>
            <Ticket className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Expired
            </CardTitle>
            <Ticket className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Value
            </CardTitle>
            <Ticket className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Profile</Label>
              <Select value={filterProfile} onValueChange={setFilterProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="All Profiles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Profiles</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Batch</Label>
              <Select value={filterBatch} onValueChange={setFilterBatch}>
                <SelectTrigger>
                  <SelectValue placeholder="All Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch} value={batch}>
                      {batch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="WAITING">Waiting</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vouchers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vouchers List</CardTitle>
              <CardDescription>Showing {vouchers.length} voucher(s)</CardDescription>
            </div>
            <div className="flex gap-2">
              {selectedVouchers.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendWhatsApp}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Send WA ({selectedVouchers.length})
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handlePrintSelected}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Selected ({selectedVouchers.length})
                  </Button>
                </>
              )}
              {filterBatch && filterBatch !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintBatch}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Batch
                </Button>
              )}
              {stats.expired > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    const confirmed = await showConfirm('Delete all EXPIRED vouchers?');
                    if (!confirmed) return;
                    
                    const res = await fetch('/api/hotspot/voucher/delete-expired', { method: 'POST' });
                    const data = await res.json();
                    if (res.ok) {
                      await showSuccess(`${data.count} expired voucher(s) deleted`);
                      loadVouchers();
                    } else {
                      await showError('Failed: ' + data.error);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Expired ({stats.expired})
                </Button>
              )}
              {filterBatch && filterBatch !== 'all' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteBatchCode(filterBatch)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Batch
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedVouchers.length > 0 && selectedVouchers.length === vouchers.filter(v => v.status === 'WAITING').length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>First Login</TableHead>
                  <TableHead>Expires At</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      No vouchers found. Generate your first batch to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  vouchers.map((voucher) => (
                    <TableRow key={voucher.id}>
                      <TableCell>
                        {voucher.status === 'WAITING' && (
                          <input
                            type="checkbox"
                            checked={selectedVouchers.includes(voucher.id)}
                            onChange={() => handleSelectVoucher(voucher.id)}
                            className="rounded border-gray-300"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-lg">
                        {voucher.code}
                      </TableCell>
                      <TableCell>{voucher.profile.name}</TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-gray-500">
                          {voucher.batchCode || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(voucher.profile.sellingPrice)}
                      </TableCell>
                      <TableCell>
                        {voucher.status === 'WAITING' && (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                            Waiting
                          </Badge>
                        )}
                        {voucher.status === 'ACTIVE' && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            Active
                          </Badge>
                        )}
                        {voucher.status === 'EXPIRED' && (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                            Expired
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {voucher.firstLoginAt ? (
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {formatDateOnly(voucher.firstLoginAt)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTimeOnly(voucher.firstLoginAt)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Not used yet</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {voucher.expiresAt ? (
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {formatDateOnly(voucher.expiresAt)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTimeOnly(voucher.expiresAt)}
                            </div>
                            {voucher.status === 'ACTIVE' && (
                              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">
                                {calculateTimeLeft(voucher.expiresAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatToWIB(voucher.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Send Dialog */}
      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Vouchers via WhatsApp</DialogTitle>
            <DialogDescription>
              Send {selectedVouchers.length} voucher(s) to customer via WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input
                type="tel"
                placeholder="628123456789"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Enter phone number with country code (e.g., 628123456789)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsWhatsAppDialogOpen(false)
                setWhatsappPhone('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleWhatsAppSubmit}
              disabled={sendingWhatsApp || !whatsappPhone}
            >
              {sendingWhatsApp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Send WhatsApp
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Template Selection Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Print Template</DialogTitle>
            <DialogDescription>
              Choose a template to print {selectedVouchers.length} voucher(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} {template.isDefault && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {templates.length === 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                No templates available. Please create a template first.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsPrintDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handlePrint} disabled={!selectedTemplate}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Vouchers from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with voucher codes. All vouchers will be assigned to the selected profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="block text-sm font-medium mb-2">CSV File *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {importFile && <FileSpreadsheet className="h-5 w-5 text-green-600" />}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Required: code column
              </p>
            </div>

            <div>
              <Label>Hotspot Profile *</Label>
              <Select value={importProfileId} onValueChange={setImportProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select profile..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name} - {formatCurrency(profile.sellingPrice)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                All imported vouchers will be assigned to this profile
              </p>
            </div>

            <div>
              <Label>Batch Code (Optional)</Label>
              <Input
                value={importBatchCode}
                onChange={(e) => setImportBatchCode(e.target.value)}
                placeholder="e.g., BATCH-001"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to auto-generate batch code
              </p>
            </div>

            {importResult && (
              <div className="p-4 border rounded-lg space-y-2 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="font-medium">
                    {importResult.success} vouchers imported successfully
                  </span>
                </div>
                {importResult.failed > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm text-red-600 font-medium">
                      {importResult.failed} vouchers failed:
                    </p>
                    <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                      {importResult.errors.map((err: any, idx: number) => (
                        <div key={idx} className="text-red-600">
                          Line {err.line} ({err.code}): {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false)
                setImportFile(null)
                setImportProfileId('')
                setImportBatchCode('')
                setImportResult(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={!importFile || !importProfileId || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Vouchers
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Batch Confirmation */}
      <AlertDialog open={!!deleteBatchCode} onOpenChange={() => setDeleteBatchCode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all <strong>unused</strong> vouchers in batch: <strong>{deleteBatchCode}</strong>
              <br />
              Used vouchers will not be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBatch} className="bg-red-600 hover:bg-red-700">
              Delete Unused
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
