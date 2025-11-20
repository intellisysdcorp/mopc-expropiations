'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Bell,
  Mail,
  Smartphone,
  Volume2,
  Clock
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/hooks/use-auth'
import clientLogger from '@/lib/client-logger';

interface NotificationPreferences {
  id?: string
  userId?: string
  enableEmailNotifications: boolean
  enableSmsNotifications: boolean
  enablePushNotifications: boolean
  enableInAppNotifications: boolean
  quietHoursEnabled: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  timezone: string
  dailyDigestEnabled: boolean
  weeklyDigestEnabled: boolean
  maxNotificationsPerHour: number
  maxNotificationsPerDay: number
  typePreferences?: Record<string, any>
  channelPreferences?: Record<string, any>
  departmentPreferences?: Record<string, any>
  priorityPreferences?: Record<string, any>
  customFilters?: any[]
  blockedSenders?: string[]
  allowedSenders?: string[]
  mobileVibrationEnabled: boolean
  mobileSoundEnabled: boolean
  mobileBadgeEnabled: boolean
  emailFormatting: 'text' | 'html' | 'both'
  emailSignatureEnabled: boolean
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications/preferences')

      if (!response.ok) {
        if (response.status === 404) {
          // Preferences don't exist, create defaults
          const defaultPreferences = await createDefaultPreferences()
          setPreferences(defaultPreferences)
          return
        }
        throw new Error('Failed to fetch preferences')
      }

      const data = await response.json()
      setPreferences(data.preferences)
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching preferences:', error)
        toast.error('Error al cargar preferencias')
      }
    } finally {
      setLoading(false)
    }
  }, []);

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  const createDefaultPreferences = async () => {
    const defaults: Partial<NotificationPreferences> = {
      enableEmailNotifications: true,
      enableSmsNotifications: false,
      enablePushNotifications: true,
      enableInAppNotifications: true,
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: 'America/Santo_Domingo',
      dailyDigestEnabled: false,
      weeklyDigestEnabled: false,
      maxNotificationsPerHour: 50,
      maxNotificationsPerDay: 200,
      mobileVibrationEnabled: true,
      mobileSoundEnabled: true,
      mobileBadgeEnabled: true,
      emailFormatting: 'both',
      emailSignatureEnabled: true
    }

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaults),
      })

      if (!response.ok) throw new Error('Failed to create preferences')

      const data = await response.json()
      return data.preferences
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error creating default preferences:', error)
        toast.error('Error al crear preferencias por defecto')
      }
      return null
    }
  }

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!preferences) return

    try {
      setSaving(true)
      const response = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update preferences')

      const data = await response.json()
      setPreferences(data.preferences)
      toast.success('Preferencias actualizadas')
    } catch (error) {
      if (error instanceof Error) {
        clientLogger.error('Error updating preferences:', error)
        toast.error('Error al actualizar preferencias')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (key: keyof NotificationPreferences, value: any) => {
    if (!preferences) return

    const updatedPreferences = {
      ...preferences,
      [key]: value
    }

    setPreferences(updatedPreferences)
    updatePreferences(updatedPreferences)
  }

  
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error al cargar preferencias</h1>
          <Button onClick={fetchPreferences}>Reintentar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración de Notificaciones</h1>
        <p className="text-muted-foreground">
          Personaliza cómo y cuándo recibes notificaciones
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="types">Móvil y Email</TabsTrigger>
          <TabsTrigger value="schedule">Horario</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Notificaciones por Email
                </CardTitle>
                <CardDescription>
                  Recibe notificaciones directamente en tu correo electrónico
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-notifications">
                    Habilitar notificaciones por email
                  </Label>
                  <Switch
                    id="email-notifications"
                    checked={preferences.enableEmailNotifications}
                    onCheckedChange={(checked) => handleToggle('enableEmailNotifications', checked)}
                    disabled={saving}
                  />
                </div>
                {preferences.enableEmailNotifications && (
                  <div className="space-y-3 pl-4 border-l-2 border-muted">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="weekly-digest" className="text-sm">
                        Resumen semanal
                      </Label>
                      <Switch
                        id="weekly-digest"
                        checked={preferences.weeklyDigestEnabled}
                        onCheckedChange={(checked) => handleToggle('weeklyDigestEnabled', checked)}
                        disabled={saving}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="daily-digest" className="text-sm">
                        Resumen diario
                      </Label>
                      <Switch
                        id="daily-digest"
                        checked={preferences.dailyDigestEnabled}
                        onCheckedChange={(checked) => handleToggle('dailyDigestEnabled', checked)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Notificaciones Push
                </CardTitle>
                <CardDescription>
                  Recibe notificaciones instantáneas en tu dispositivo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="push-notifications">
                    Habilitar notificaciones push
                  </Label>
                  <Switch
                    id="push-notifications"
                    checked={preferences.enablePushNotifications}
                    onCheckedChange={(checked) => handleToggle('enablePushNotifications', checked)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notificaciones en App
                </CardTitle>
                <CardDescription>
                  Notificaciones dentro de la aplicación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="inapp-notifications">
                    Habilitar notificaciones en la app
                  </Label>
                  <Switch
                    id="inapp-notifications"
                    checked={preferences.enableInAppNotifications}
                    onCheckedChange={(checked) => handleToggle('enableInAppNotifications', checked)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Mobile Settings */}
        <TabsContent value="types" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Configuración Móvil
                </CardTitle>
                <CardDescription>
                  Preferencias para notificaciones móviles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mobile-vibration">
                    Vibración
                  </Label>
                  <Switch
                    id="mobile-vibration"
                    checked={preferences.mobileVibrationEnabled}
                    onCheckedChange={(checked) => handleToggle('mobileVibrationEnabled', checked)}
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="mobile-sound">
                    Sonido
                  </Label>
                  <Switch
                    id="mobile-sound"
                    checked={preferences.mobileSoundEnabled}
                    onCheckedChange={(checked) => handleToggle('mobileSoundEnabled', checked)}
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="mobile-badge">
                    Badge de notificaciones
                  </Label>
                  <Switch
                    id="mobile-badge"
                    checked={preferences.mobileBadgeEnabled}
                    onCheckedChange={(checked) => handleToggle('mobileBadgeEnabled', checked)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Configuración de Email
                </CardTitle>
                <CardDescription>
                  Preferencias para notificaciones por email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-signature">
                    Incluir firma en emails
                  </Label>
                  <Switch
                    id="email-signature"
                    checked={preferences.emailSignatureEnabled}
                    onCheckedChange={(checked) => handleToggle('emailSignatureEnabled', checked)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-formatting">Formato de email</Label>
                  <Select
                    value={preferences.emailFormatting}
                    onValueChange={(value: 'text' | 'html' | 'both') => handleToggle('emailFormatting', value)}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto plano</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                      <SelectItem value="both">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schedule Settings */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horario Silencioso
              </CardTitle>
              <CardDescription>
                Configura horas en las que no deseas recibir notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="quiet-hours">Habilitar horario silencioso</Label>
                  <p className="text-sm text-muted-foreground">
                    No recibir notificaciones durante las horas especificadas
                  </p>
                </div>
                <Switch
                  id="quiet-hours"
                  checked={preferences.quietHoursEnabled}
                  onCheckedChange={(checked) => handleToggle('quietHoursEnabled', checked)}
                  disabled={saving}
                />
              </div>

              {preferences.quietHoursEnabled && (
                <div className="grid gap-4 md:grid-cols-2 pl-4 border-l-2 border-muted">
                  <div>
                    <Label htmlFor="quiet-hours-start">Hora de inicio</Label>
                    <input
                      id="quiet-hours-start"
                      type="time"
                      value={preferences.quietHoursStart || '22:00'}
                      onChange={(e) => handleToggle('quietHoursStart', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quiet-hours-end">Hora de fin</Label>
                    <input
                      id="quiet-hours-end"
                      type="time"
                      value={preferences.quietHoursEnd || '08:00'}
                      onChange={(e) => handleToggle('quietHoursEnd', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={saving}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
              <CardDescription>
                Tu email actual para notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{user?.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Email principal para notificaciones
                  </p>
                </div>
                <Badge variant="outline">
                  Verificado
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status indicator */}
      {saving && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
          <span className="text-sm text-muted-foreground">Guardando cambios...</span>
        </div>
      )}
    </div>
  )
}