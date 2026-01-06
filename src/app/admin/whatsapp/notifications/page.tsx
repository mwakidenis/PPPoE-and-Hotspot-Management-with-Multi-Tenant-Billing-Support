"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Bell, Clock, Plus, Trash2, Save, Shield, Timer } from "lucide-react"
import { showSuccess, showError } from '@/lib/sweetalert'

interface ReminderSettings {
  id: string
  enabled: boolean
  reminderDays: number[]
  reminderTime: string
  otpEnabled: boolean
  otpExpiry: number
  updatedAt: string
}

export default function NotificationSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<ReminderSettings | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [reminderDays, setReminderDays] = useState<number[]>([-7, -5, -3, 0])
  const [reminderTime, setReminderTime] = useState("09:00")
  const [otpEnabled, setOtpEnabled] = useState(true)
  const [otpExpiry, setOtpExpiry] = useState(5)
  const [newDay, setNewDay] = useState("")

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/whatsapp/reminder-settings')
      const data = await res.json()
      
      if (data.success && data.settings) {
        setSettings(data.settings)
        setEnabled(data.settings.enabled)
        setReminderDays(data.settings.reminderDays)
        setReminderTime(data.settings.reminderTime)
        setOtpEnabled(data.settings.otpEnabled ?? true)
        setOtpExpiry(data.settings.otpExpiry ?? 5)
      }
    } catch (error) {
      console.error('Load settings error:', error)
    } finally {
      setLoading(false)
    }
  }

  const addReminderDay = () => {
    const day = parseInt(newDay)
    if (isNaN(day)) {
      showError('Masukkan angka yang valid')
      return
    }
    if (day > 0) {
      showError('Nilai harus 0 atau negatif (contoh: -7 untuk H-7)')
      return
    }
    if (reminderDays.includes(day)) {
      showError('Hari ini sudah ada dalam daftar')
      return
    }
    
    const newDays = [...reminderDays, day].sort((a, b) => a - b)
    setReminderDays(newDays)
    setNewDay("")
  }

  const removeReminderDay = (day: number) => {
    setReminderDays(reminderDays.filter(d => d !== day))
  }

  const handleSave = async () => {
    if (reminderDays.length === 0) {
      await showError('Minimal harus ada 1 hari reminder')
      return
    }

    if (otpExpiry < 1 || otpExpiry > 60) {
      await showError('OTP expiry harus antara 1-60 menit')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/whatsapp/reminder-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          reminderDays,
          reminderTime,
          otpEnabled,
          otpExpiry
        })
      })

      const data = await res.json()

      if (data.success) {
        await showSuccess('Pengaturan berhasil disimpan')
        loadSettings()
      } else {
        await showError('Gagal menyimpan: ' + data.error)
      }
    } catch (error) {
      console.error('Save error:', error)
      await showError('Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  const formatDayLabel = (day: number) => {
    if (day === 0) return "H (Hari Expired)"
    return `H${day} (${Math.abs(day)} hari sebelum expired)`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifikasi WhatsApp</h1>
        <p className="text-gray-500 mt-1">
          Atur pengiriman notifikasi reminder invoice & OTP login customer
        </p>
      </div>

      {/* Invoice Reminder Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Invoice Reminder Settings
          </CardTitle>
          <CardDescription>
            Konfigurasi kapan sistem akan mengirim reminder invoice ke customer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="enabled" className="text-base font-medium">
                Aktifkan Reminder Otomatis
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Kirim notifikasi WhatsApp otomatis untuk invoice yang akan jatuh tempo
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminderTime" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Jam Pengiriman (WIB)
            </Label>
            <Input
              id="reminderTime"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-sm text-gray-500">
              Notifikasi akan dikirim pada jam ini setiap harinya
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Jadwal Reminder</Label>
            <p className="text-sm text-gray-500">
              Tentukan kapan reminder akan dikirim (relatif terhadap tanggal expired)
            </p>

            <div className="flex flex-wrap gap-2">
              {reminderDays.length === 0 ? (
                <div className="text-sm text-gray-400 italic">
                  Belum ada jadwal reminder
                </div>
              ) : (
                reminderDays.map((day) => (
                  <Badge 
                    key={day} 
                    variant="outline" 
                    className="px-3 py-2 text-sm flex items-center gap-2"
                  >
                    {formatDayLabel(day)}
                    <button
                      onClick={() => removeReminderDay(day)}
                      className="hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="-7"
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addReminderDay()}
                className="max-w-xs"
              />
              <Button onClick={addReminderDay} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Tambah
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Contoh: -7 untuk H-7 (7 hari sebelum expired), 0 untuk hari H (hari expired)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* OTP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Customer OTP Login
          </CardTitle>
          <CardDescription>
            Pengaturan OTP untuk login customer self-service portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="otpEnabled" className="text-base font-medium">
                Aktifkan OTP Login
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Customer bisa login menggunakan OTP via WhatsApp
              </p>
            </div>
            <Switch
              id="otpEnabled"
              checked={otpEnabled}
              onCheckedChange={setOtpEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="otpExpiry" className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Masa Berlaku OTP (Menit)
            </Label>
            <Input
              id="otpExpiry"
              type="number"
              min="1"
              max="60"
              value={otpExpiry}
              onChange={(e) => setOtpExpiry(parseInt(e.target.value))}
              className="max-w-xs"
            />
            <p className="text-sm text-gray-500">
              Kode OTP akan expired setelah {otpExpiry} menit
            </p>
          </div>

          {!otpEnabled && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Customer tidak akan bisa login ke portal self-service jika OTP dinonaktifkan
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          size="lg"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Simpan Pengaturan
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
