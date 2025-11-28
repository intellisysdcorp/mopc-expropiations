'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import {
  Mail,
  Bell,
  Clock,
  Settings,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clientLogger from '@/lib/client-logger';

interface NotificationPreferences {
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  enablePushNotifications: boolean;
  enableInAppNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
  dailyDigestEnabled: boolean;
  weeklyDigestEnabled: boolean;
  maxNotificationsPerHour: number;
  maxNotificationsPerDay: number;
  typePreferences: Record<string, any>;
  channelPreferences: Record<string, any>;
  departmentPreferences: Record<string, any>;
  priorityPreferences: Record<string, any>;
  customFilters: any[];
  blockedSenders: string[];
  allowedSenders: string[];
  mobileVibrationEnabled: boolean;
  mobileSoundEnabled: boolean;
  mobileBadgeEnabled: boolean;
  emailFormatting: 'text' | 'html' | 'both';
  emailSignatureEnabled: boolean;
}

interface NotificationPreferencesProps {
  className?: string;
  onSave?: (preferences: NotificationPreferences) => void;
}

const DEFAULT_PREFERENCES: Partial<NotificationPreferences> = {
  enableEmailNotifications: true,
  enableSmsNotifications: false,
  enablePushNotifications: true,
  enableInAppNotifications: true,
  quietHoursEnabled: false,
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
};

const TIMEZONES = [
  'America/Santo_Domingo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Madrid',
  'Asia/Tokyo'
];

const NOTIFICATION_TYPES = [
  { value: 'INFO', label: 'Información', icon: Bell },
  { value: 'WARNING', label: 'Advertencias', icon: Settings },
  { value: 'ERROR', label: 'Errores', icon: Alert },
  { value: 'SUCCESS', label: 'Éxitos', icon: Bell },
  { value: 'TASK_ASSIGNED', label: 'Tareas Asignadas', icon: Mail },
  { value: 'DEADLINE_REMINDER', label: 'Recordatorios', icon: Clock },
  { value: 'STATUS_UPDATE', label: 'Actualizaciones', icon: RefreshCw },
  { value: 'SYSTEM_ANNOUNCEMENT', label: 'Anuncios del Sistema', icon: Bell }
];

export function NotificationPreferences({ className, onSave }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES as NotificationPreferences);
  const [_originalPreferences, setOriginalPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES as NotificationPreferences);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/preferences');

      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const data = await response.json();
      setPreferences(data.preferences);
      setOriginalPreferences(data.preferences);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching preferences:', error);
      }
      toast.error('Error al cargar preferencias');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);

      const response = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      const data = await response.json();
      setPreferences(data.preferences);
      setOriginalPreferences(data.preferences);
      setHasChanges(false);

      toast.success('Preferencias guardadas exitosamente');
      onSave?.(data.preferences);

    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error saving preferences:', error);
      }
      toast.error('Error al guardar preferencias');
    } finally {
      setSaving(false);
    }
  };

  const resetPreferences = async () => {
    try {
      setSaving(true);

      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reset preferences');
      }

      const data = await response.json();
      setPreferences(data.preferences);
      setOriginalPreferences(data.preferences);
      setHasChanges(false);

      toast.success('Preferencias restablecidas exitosamente');
      onSave?.(data.preferences);

    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error resetting preferences:', error);
      }
      toast.error('Error al restablecer preferencias');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const updateTypePreference = (type: string, channels: string[]) => {
    setPreferences(prev => ({
      ...prev,
      typePreferences: {
        ...prev.typePreferences,
        [type]: { channels }
      }
    }));
    setHasChanges(true);
  };

  const getTypeChannels = (type: string): string[] => {
    return preferences.typePreferences?.[type]?.channels || ['in_app'];
  };

  const addBlockedSender = (sender: string) => {
    if (sender && !preferences.blockedSenders.includes(sender)) {
      updatePreference('blockedSenders', [...preferences.blockedSenders, sender]);
    }
  };

  const removeBlockedSender = (sender: string) => {
    updatePreference('blockedSenders', preferences.blockedSenders.filter(s => s !== sender));
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ml-2">Cargando preferencias...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Preferencias de Notificación</CardTitle>
            <CardDescription>
              Configura cómo y cuándo recibes notificaciones
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="secondary">No guardado</Badge>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Restablecer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Restablecer Preferencias</DialogTitle>
                  <DialogDescription>
                    ¿Estás seguro de que deseas restablecer todas las preferencias a sus valores predeterminados?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancelar</Button>
                  <Button variant="destructive" onClick={resetPreferences} disabled={saving}>
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                    Restablecer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={savePreferences} disabled={saving || !hasChanges}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar Cambios
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="channels">Canales</TabsTrigger>
            <TabsTrigger value="types">Tipos</TabsTrigger>
            <TabsTrigger value="schedule">Horario</TabsTrigger>
            <TabsTrigger value="limits">Límites</TabsTrigger>
            <TabsTrigger value="filters">Filtros</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Canales de Notificación</h3>

              <div className="grid gap-4">
                <div className="flex items-center justify-between space-y-0 pb-4">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Notificaciones en la Aplicación</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe notificaciones directamente en la plataforma
                    </p>
                  </div>
                  <Switch
                    checked={preferences.enableInAppNotifications}
                    onCheckedChange={(checked) => updatePreference('enableInAppNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between space-y-0 pb-4">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Correo Electrónico</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe notificaciones por correo electrónico
                    </p>
                  </div>
                  <Switch
                    checked={preferences.enableEmailNotifications}
                    onCheckedChange={(checked) => updatePreference('enableEmailNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between space-y-0 pb-4">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">SMS</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe notificaciones por mensaje de texto
                    </p>
                  </div>
                  <Switch
                    checked={preferences.enableSmsNotifications}
                    onCheckedChange={(checked) => updatePreference('enableSmsNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between space-y-0 pb-4">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Notificaciones Push</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe notificaciones push en tu dispositivo móvil
                    </p>
                  </div>
                  <Switch
                    checked={preferences.enablePushNotifications}
                    onCheckedChange={(checked) => updatePreference('enablePushNotifications', checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Preferencias Móviles</h3>

              <div className="grid gap-4">
                <div className="flex items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <Label>Vibración</Label>
                    <p className="text-sm text-muted-foreground">
                      Vibrar al recibir notificaciones
                    </p>
                  </div>
                  <Switch
                    checked={preferences.mobileVibrationEnabled}
                    onCheckedChange={(checked) => updatePreference('mobileVibrationEnabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <Label>Sonido</Label>
                    <p className="text-sm text-muted-foreground">
                      Reproducir sonido al recibir notificaciones
                    </p>
                  </div>
                  <Switch
                    checked={preferences.mobileSoundEnabled}
                    onCheckedChange={(checked) => updatePreference('mobileSoundEnabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <Label>Badge de Icono</Label>
                    <p className="text-sm text-muted-foreground">
                      Mostrar contador en el icono de la aplicación
                    </p>
                  </div>
                  <Switch
                    checked={preferences.mobileBadgeEnabled}
                    onCheckedChange={(checked) => updatePreference('mobileBadgeEnabled', checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Preferencias de Correo</h3>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Formato de Correo</Label>
                  <Select
                    value={preferences.emailFormatting}
                    onValueChange={(value: 'text' | 'html' | 'both') =>
                      updatePreference('emailFormatting', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Solo Texto</SelectItem>
                      <SelectItem value="html">Solo HTML</SelectItem>
                      <SelectItem value="both">Texto y HTML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <Label>Firma de Correo</Label>
                    <p className="text-sm text-muted-foreground">
                      Incluir firma automática en correos enviados
                    </p>
                  </div>
                  <Switch
                    checked={preferences.emailSignatureEnabled}
                    onCheckedChange={(checked) => updatePreference('emailSignatureEnabled', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="types" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Notificaciones por Tipo</h3>
              <p className="text-sm text-muted-foreground">
                Configura qué canales usar para cada tipo de notificación
              </p>

              <div className="grid gap-4">
                {NOTIFICATION_TYPES.map(({ value, label, icon: Icon }) => {
                  const typeChannels = getTypeChannels(value);

                  return (
                    <div key={value} className="border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{label}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {['in_app', 'email', 'sms', 'push'].map((channel) => {
                          const channelLabels = {
                            in_app: 'App',
                            email: 'Email',
                            sms: 'SMS',
                            push: 'Push'
                          };

                          return (
                            <Button
                              key={channel}
                              variant={typeChannels.includes(channel) ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                const newChannels = typeChannels.includes(channel)
                                  ? typeChannels.filter(c => c !== channel)
                                  : [...typeChannels, channel];
                                updateTypePreference(value, newChannels);
                              }}
                            >
                              {channelLabels[channel as keyof typeof channelLabels]}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Horario de Notificaciones</h3>

              <div className="flex items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Horas de Silencio</Label>
                  <p className="text-sm text-muted-foreground">
                    Deshabilitar notificaciones durante ciertas horas
                  </p>
                </div>
                <Switch
                  checked={preferences.quietHoursEnabled}
                  onCheckedChange={(checked) => updatePreference('quietHoursEnabled', checked)}
                />
              </div>

              {preferences.quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label>Inicio</Label>
                    <Input
                      type="time"
                      value={preferences.quietHoursStart || ''}
                      onChange={(e) => updatePreference('quietHoursStart', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fin</Label>
                    <Input
                      type="time"
                      value={preferences.quietHoursEnd || ''}
                      onChange={(e) => updatePreference('quietHoursEnd', e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Zona Horaria</Label>
                <Select
                  value={preferences.timezone}
                  onValueChange={(value) => updatePreference('timezone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((timezone) => (
                      <SelectItem key={timezone} value={timezone}>
                        {timezone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Resúmenes Diarios</h3>

              <div className="grid gap-4">
                <div className="flex items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <Label>Resumen Diario</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe un resumen diario de todas las notificaciones
                    </p>
                  </div>
                  <Switch
                    checked={preferences.dailyDigestEnabled}
                    onCheckedChange={(checked) => updatePreference('dailyDigestEnabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <Label>Resumen Semanal</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe un resumen semanal de todas las notificaciones
                    </p>
                  </div>
                  <Switch
                    checked={preferences.weeklyDigestEnabled}
                    onCheckedChange={(checked) => updatePreference('weeklyDigestEnabled', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="limits" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Límites de Notificaciones</h3>
              <p className="text-sm text-muted-foreground">
                Establece límites para evitar sobrecarga de notificaciones
              </p>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Máximo de Notificaciones por Hora</Label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={preferences.maxNotificationsPerHour}
                    onChange={(e) => updatePreference('maxNotificationsPerHour', parseInt(e.target.value) || 50)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Número máximo de notificaciones que puedes recibir por hora
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Máximo de Notificaciones por Día</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10000"
                    value={preferences.maxNotificationsPerDay}
                    onChange={(e) => updatePreference('maxNotificationsPerDay', parseInt(e.target.value) || 200)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Número máximo de notificaciones que puedes recibir por día
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="filters" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Filtros Personalizados</h3>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Remitentes Bloqueados</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    No recibir notificaciones de estos remitentes
                  </p>

                  <div className="space-y-2">
                    {preferences.blockedSenders.map((sender) => (
                      <div key={sender} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">{sender}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBlockedSender(sender)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <Input
                        placeholder="Agregar remitente a bloquear..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addBlockedSender(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          const input = e.currentTarget.parentElement?.querySelector('input');
                          if (input) {
                            addBlockedSender(input.value);
                            input.value = '';
                          }
                        }}
                      >
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default NotificationPreferences;