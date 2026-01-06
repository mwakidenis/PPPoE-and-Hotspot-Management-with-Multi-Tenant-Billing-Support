"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Loader2, Trash2, Edit, Ticket } from "lucide-react"

interface HotspotProfile {
  id: string
  name: string
  costPrice: number
  resellerFee: number
  sellingPrice: number
  speed: string
  groupProfile: string | null
  sharedUsers: number
  validityValue: number
  validityUnit: string
  agentAccess: boolean
  eVoucherAccess: boolean
  isActive: boolean
}

export default function HotspotProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<HotspotProfile[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<HotspotProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    costPrice: "",
    resellerFee: "0",
    speed: "",
    groupProfile: "",
    sharedUsers: "1",
    validityValue: "",
    validityUnit: "HOURS",
    agentAccess: true,
    eVoucherAccess: true,
  })

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/hotspot/profiles')
      const data = await res.json()
      setProfiles(data.profiles || [])
    } catch (error) {
      console.error('Load profiles error:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      costPrice: "",
      resellerFee: "0",
      speed: "",
      groupProfile: "",
      sharedUsers: "1",
      validityValue: "",
      validityUnit: "HOURS",
      agentAccess: true,
      eVoucherAccess: true,
    })
    setEditingProfile(null)
  }

  const handleEdit = (profile: HotspotProfile) => {
    setEditingProfile(profile)
    setFormData({
      name: profile.name,
      costPrice: profile.costPrice.toString(),
      resellerFee: profile.resellerFee.toString(),
      speed: profile.speed,
      groupProfile: profile.groupProfile || "",
      sharedUsers: profile.sharedUsers.toString(),
      validityValue: profile.validityValue.toString(),
      validityUnit: profile.validityUnit,
      agentAccess: profile.agentAccess,
      eVoucherAccess: profile.eVoucherAccess,
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = '/api/hotspot/profiles'
      const method = editingProfile ? 'PUT' : 'POST'
      const body = editingProfile
        ? { id: editingProfile.id, ...formData }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        resetForm()
        loadProfiles()
      } else {
        const error = await res.json()
        alert('Failed: ' + error.error)
      }
    } catch (error) {
      console.error('Save profile error:', error)
      alert('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteProfileId) return

    try {
      const res = await fetch(`/api/hotspot/profiles?id=${deleteProfileId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        loadProfiles()
      } else {
        const error = await res.json()
        alert('Failed: ' + error.error)
      }
    } catch (error) {
      console.error('Delete profile error:', error)
      alert('Failed to delete profile')
    } finally {
      setDeleteProfileId(null)
    }
  }

  const formatValidity = (value: number, unit: string) => {
    const unitMap: Record<string, string> = {
      MINUTES: value === 1 ? 'Minute' : 'Minutes',
      HOURS: value === 1 ? 'Hour' : 'Hours',
      DAYS: value === 1 ? 'Day' : 'Days',
      MONTHS: value === 1 ? 'Month' : 'Months',
    }
    return `${value} ${unitMap[unit] || unit}`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const sellingPrice = parseFloat(formData.costPrice || '0') + parseFloat(formData.resellerFee || '0')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Hotspot Profiles
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage hotspot voucher profiles and pricing
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProfile ? 'Edit Profile' : 'Add Profile'}</DialogTitle>
              <DialogDescription>
                {editingProfile ? 'Update hotspot profile settings' : 'Create a new hotspot profile'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Profile Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 3Jam-5M, 1Hari-10M"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costPrice">Cost Price *</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    min="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resellerFee">Reseller Fee</Label>
                  <Input
                    id="resellerFee"
                    type="number"
                    min="0"
                    value={formData.resellerFee}
                    onChange={(e) => setFormData({ ...formData, resellerFee: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Selling Price</Label>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(sellingPrice)}
                </div>
                <p className="text-xs text-gray-500">Cost Price + Reseller Fee</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="speed">Speed *</Label>
                  <Input
                    id="speed"
                    value={formData.speed}
                    onChange={(e) => setFormData({ ...formData, speed: e.target.value })}
                    placeholder="e.g. 5M/5M"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="groupProfile">Group Profile</Label>
                  <Input
                    id="groupProfile"
                    value={formData.groupProfile}
                    onChange={(e) => setFormData({ ...formData, groupProfile: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sharedUsers">Shared Users *</Label>
                  <Input
                    id="sharedUsers"
                    type="number"
                    min="1"
                    value={formData.sharedUsers}
                    onChange={(e) => setFormData({ ...formData, sharedUsers: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="validityValue">Validity *</Label>
                  <Input
                    id="validityValue"
                    type="number"
                    min="1"
                    value={formData.validityValue}
                    onChange={(e) => setFormData({ ...formData, validityValue: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="validityUnit">Validity Unit</Label>
                <Select
                  value={formData.validityUnit}
                  onValueChange={(value) => setFormData({ ...formData, validityUnit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MINUTES">Minutes</SelectItem>
                    <SelectItem value="HOURS">Hours</SelectItem>
                    <SelectItem value="DAYS">Days</SelectItem>
                    <SelectItem value="MONTHS">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-medium">Access Settings</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="agentAccess"
                    checked={formData.agentAccess}
                    onChange={(e) => setFormData({ ...formData, agentAccess: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="agentAccess" className="text-sm font-medium cursor-pointer">
                    Agent Access
                  </label>
                </div>
                <p className="text-xs text-gray-500 ml-6">Allow agents/resellers to generate vouchers with this profile</p>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="eVoucherAccess"
                    checked={formData.eVoucherAccess}
                    onChange={(e) => setFormData({ ...formData, eVoucherAccess: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="eVoucherAccess" className="text-sm font-medium cursor-pointer">
                    e-Voucher Access
                  </label>
                </div>
                <p className="text-xs text-gray-500 ml-6">Enable this profile for e-voucher generation system</p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingProfile ? 'Update' : 'Create'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Profiles
            </CardTitle>
            <Ticket className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Active Profiles
            </CardTitle>
            <Ticket className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profiles.filter(p => p.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Avg. Selling Price
            </CardTitle>
            <Ticket className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {profiles.length > 0 ? formatCurrency(profiles.reduce((sum, p) => sum + p.sellingPrice, 0) / profiles.length) : 'Rp 0'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profiles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Profiles List</CardTitle>
          <CardDescription>
            All hotspot profiles configured in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile Name</TableHead>
                  <TableHead>Speed</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Cost Price</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No profiles yet. Add your first profile to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell className="font-mono text-sm">{profile.speed}</TableCell>
                      <TableCell>{formatValidity(profile.validityValue, profile.validityUnit)}</TableCell>
                      <TableCell>{formatCurrency(profile.costPrice)}</TableCell>
                      <TableCell className="font-medium text-green-600">
                        {formatCurrency(profile.sellingPrice)}
                      </TableCell>
                      <TableCell>
                        {profile.isActive ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(profile)}
                            className="h-8 w-8 p-0"
                            title="Edit Profile"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteProfileId(profile.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            title="Delete Profile"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProfileId} onOpenChange={() => setDeleteProfileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will permanently delete this profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
