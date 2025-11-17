'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Video, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveContainer } from '@/components/ui/responsive-container'
import { toast } from 'react-hot-toast'

import { MeetingFormData } from '@/types/client'
import { User, Case } from '@/types/client'
import clientLogger from '@/lib/client-logger';

const MEETING_TYPES = [
  { value: 'SITE_VISIT', label: 'Visita al Sitio', description: 'Inspección física del predio' },
  { value: 'COORDINATION', label: 'Coordinación', description: 'Reunión de coordinación interna' },
  { value: 'DECISION', label: 'Toma de Decisión', description: 'Reunión para decisiones importantes' },
  { value: 'TECHNICAL_REVIEW', label: 'Revisión Técnica', description: 'Análisis técnico de aspectos del caso' },
  { value: 'NEGOTIATION', label: 'Negociación', description: 'Negociación con propietarios' },
  { value: 'PUBLIC_HEARING', label: 'Audiencia Pública', description: 'Audiencia pública o comunitaria' },
  { value: 'INTERNAL', label: 'Interna', description: 'Reunión interna del departamento' },
  { value: 'EXTERNAL', label: 'Externa', description: 'Reunión con entidades externas' }
]

const PRIORITIES = [
  { value: 'LOW', label: 'Baja', description: 'Sin urgencia particular' },
  { value: 'MEDIUM', label: 'Media', description: 'Prioridad normal' },
  { value: 'HIGH', label: 'Alta', description: 'Requiere atención pronta' },
  { value: 'URGENT', label: 'Urgente', description: 'Máxima prioridad' }
]

const TIMEZONES = [
  { value: 'America/Santo_Domingo', label: 'Santo Domingo (GMT-4)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5/4)' },
  { value: 'America/Miami', label: 'Miami (GMT-5/4)' }
]

const DURATION_OPTIONS = [
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1.5 horas' },
  { value: '120', label: '2 horas' },
  { value: '180', label: '3 horas' },
  { value: '240', label: '4 horas' }
]

export default function CreateMeetingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [formData, setFormData] = useState<MeetingFormData>({
    title: '',
    description: '',
    meetingType: '',
    priority: 'MEDIUM',
    location: '',
    virtual: false,
    meetingUrl: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
    timezone: 'America/Santo_Domingo',
    maxParticipants: 10,
    allowGuests: true,
    requireApproval: false,
    isPrivate: false,
    recordMeeting: false,
    enableChat: true,
    enableScreenShare: true,
    isRecurring: false,
    recurrenceRule: '',
    chairId: '',
    caseId: '',
    tags: ''
  })

  // Fetch users and cases
  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([
        fetch('/api/users?limit=100'),
        fetch('/api/cases?limit=100')
      ])
        .then(([usersRes, casesRes]) =>
          Promise.all([
            usersRes.json(),
            casesRes.json()
          ])
        )
        .then(([usersData, casesData]) => {
          setUsers(usersData.users || [])
          setCases(casesData.cases || [])
        })
        .catch(error => {
          clientLogger.error('Error fetching data:', error)
          toast.error('Error al cargar datos necesarios')
        })
    }
  }, [status])

  // Handle form field changes
  const handleInputChange = (field: keyof MeetingFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle participant selection
  const handleParticipantToggle = (userId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  // Calculate end time based on start time and duration
  const calculateEndTime = (startTime: string, duration: number) => {
    if (!startTime) return ''

    const start = new Date(startTime)
    const end = new Date(start.getTime() + duration * 60000)
    return end.toISOString().slice(0, 16)
  }

  // Handle start time change
  const handleStartTimeChange = (startTime: string) => {
    handleInputChange('scheduledStartTime', startTime)

    // Auto-calculate end time if not set
    if (!formData.scheduledEndTime && startTime) {
      const duration = 60 // Default 60 minutes
      handleInputChange('scheduledEndTime', calculateEndTime(startTime, duration))
    }
  }

  // Handle duration change
  const handleDurationChange = (duration: string) => {
    if (formData.scheduledStartTime) {
      handleInputChange('scheduledEndTime', calculateEndTime(formData.scheduledStartTime, parseInt(duration)))
    }
  }

  // Form validation
  const validateForm = () => {
    const errors = []

    if (!formData.title.trim()) errors.push('El título es requerido')
    if (!formData.meetingType) errors.push('El tipo de reunión es requerido')
    if (!formData.scheduledStartTime) errors.push('La fecha y hora de inicio son requeridas')
    if (!formData.scheduledEndTime) errors.push('La fecha y hora de fin son requeridas')

    const start = new Date(formData.scheduledStartTime)
    const end = new Date(formData.scheduledEndTime)
    if (start >= end) errors.push('La hora de fin debe ser posterior a la hora de inicio')

    if (formData.virtual && !formData.meetingUrl) {
      errors.push('La URL de la reunión es requerida para reuniones virtuales')
    }

    if (!formData.virtual && !formData.location) {
      errors.push('La ubicación es requerida para reuniones presenciales')
    }

    if (errors.length > 0) {
      errors.forEach(error => toast.error(error))
      return false
    }

    return true
  }

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)

    try {
      const meetingData = {
        ...formData,
        scheduledStartTime: new Date(formData.scheduledStartTime).toISOString(),
        scheduledEndTime: new Date(formData.scheduledEndTime).toISOString(),
        participants: selectedParticipants
      }

      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al crear la reunión')
      }

      const meeting = await response.json()
      toast.success('Reunión creada exitosamente')
      router.push(`/meetings/${meeting.id}`)

    } catch (error: any) {
      clientLogger.error('Error creating meeting:', error)
      toast.error(error.message || 'Error al crear la reunión')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <ResponsiveContainer size="xl" padding="lg">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer size="xl" padding="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Crear Nueva Reunión</h1>
            <p className="text-muted-foreground">Complete los detalles de la reunión</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList>
              <TabsTrigger value="basic">Información Básica</TabsTrigger>
              <TabsTrigger value="participants">Participantes</TabsTrigger>
              <TabsTrigger value="settings">Configuración</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>Información de la Reunión</CardTitle>
                  <CardDescription>
                    Información básica sobre la reunión
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Título de la Reunión *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Ej: Reunión de coordinación - Caso EXP-2024-001"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describa el propósito y objetivos de la reunión..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Meeting Type */}
                    <div className="space-y-2">
                      <Label htmlFor="meetingType">Tipo de Reunión *</Label>
                      <Select value={formData.meetingType} onValueChange={(value) => handleInputChange('meetingType', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione el tipo de reunión" />
                        </SelectTrigger>
                        <SelectContent>
                          {MEETING_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div>
                                <div className="font-medium">{type.label}</div>
                                <div className="text-sm text-muted-foreground">{type.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                      <Label htmlFor="priority">Prioridad</Label>
                      <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map(priority => (
                            <SelectItem key={priority.value} value={priority.value}>
                              <div>
                                <div className="font-medium">{priority.label}</div>
                                <div className="text-sm text-muted-foreground">{priority.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Date and Time */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="scheduledStartTime">Fecha y Hora Inicio *</Label>
                      <Input
                        id="scheduledStartTime"
                        type="datetime-local"
                        value={formData.scheduledStartTime}
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration">Duración</Label>
                      <Select onValueChange={handleDurationChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione duración" />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scheduledEndTime">Fecha y Hora Fin *</Label>
                      <Input
                        id="scheduledEndTime"
                        type="datetime-local"
                        value={formData.scheduledEndTime}
                        onChange={(e) => handleInputChange('scheduledEndTime', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Timezone */}
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Zona Horaria</Label>
                      <Select value={formData.timezone} onValueChange={(value) => handleInputChange('timezone', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map(tz => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Related Case */}
                    <div className="space-y-2">
                      <Label htmlFor="caseId">Caso Relacionado (Opcional)</Label>
                      <Select value={formData.caseId || 'none'} onValueChange={(value) => handleInputChange('caseId', value === 'none' ? '' : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un caso si aplica" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ningún caso</SelectItem>
                          {cases.map(case_ => (
                            <SelectItem key={case_.id} value={case_.id}>
                              {case_.fileNumber} - {case_.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Meeting Mode */}
                  <div className="space-y-4">
                    <Label>Modalidad de la Reunión</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card
                        className={`cursor-pointer transition-all ${
                          !formData.virtual
                            ? 'ring-2 ring-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleInputChange('virtual', false)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <MapPin className="h-5 w-5 text-green-600" />
                            <div>
                              <div className="font-medium">Presencial</div>
                              <div className="text-sm text-muted-foreground">Reunión en ubicación física</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all ${
                          formData.virtual
                            ? 'ring-2 ring-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleInputChange('virtual', true)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <Video className="h-5 w-5 text-blue-600" />
                            <div>
                              <div className="font-medium">Virtual</div>
                              <div className="text-sm text-muted-foreground">Reunión por videoconferencia</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Location or URL */}
                  {formData.virtual ? (
                    <div className="space-y-2">
                      <Label htmlFor="meetingUrl">URL de la Reunión Virtual *</Label>
                      <Input
                        id="meetingUrl"
                        type="url"
                        value={formData.meetingUrl}
                        onChange={(e) => handleInputChange('meetingUrl', e.target.value)}
                        placeholder="https://zoom.us/j/123456789"
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="location">Ubicación *</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder="Ej: Sala de Conferencias, Oficina Central, 3er piso"
                        required
                      />
                    </div>
                  )}

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label htmlFor="tags">Etiquetas (Separadas por comas)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => handleInputChange('tags', e.target.value)}
                      placeholder="Ej: urgente, coordinación, legal, técnico"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Participants Tab */}
            <TabsContent value="participants">
              <Card>
                <CardHeader>
                  <CardTitle>Participantes</CardTitle>
                  <CardDescription>
                    Seleccione los participantes para esta reunión
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Chair */}
                  <div className="space-y-2">
                    <Label htmlFor="chairId">Presidente de la Reunión (Opcional)</Label>
                    <Select value={formData.chairId || 'none'} onValueChange={(value) => handleInputChange('chairId', value === 'none' ? '' : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione quién presidirá la reunión" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin presidente específico</SelectItem>
                        {users.filter(user => user.isActive).map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} - {user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Participants */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Participantes</Label>
                      <Badge variant="secondary">
                        {selectedParticipants.length} seleccionados
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {users.filter(user => user.isActive).map(user => (
                        <div key={user.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedParticipants.includes(user.id)}
                            onCheckedChange={() => handleParticipantToggle(user.id)}
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={`user-${user.id}`}
                              className="font-medium cursor-pointer"
                            >
                              {user.name}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración Adicional</CardTitle>
                  <CardDescription>
                    Configure las opciones avanzadas de la reunión
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Meeting Settings */}
                  <div className="space-y-4">
                    <Label>Configuración de la Reunión</Label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="allowGuests"
                            checked={formData.allowGuests}
                            onCheckedChange={(checked) => handleInputChange('allowGuests', checked)}
                          />
                          <Label htmlFor="allowGuests">Permitir Invitados Externos</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="requireApproval"
                            checked={formData.requireApproval}
                            onCheckedChange={(checked) => handleInputChange('requireApproval', checked)}
                          />
                          <Label htmlFor="requireApproval">Requerir Aprobación para Unirse</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="isPrivate"
                            checked={formData.isPrivate}
                            onCheckedChange={(checked) => handleInputChange('isPrivate', checked)}
                          />
                          <Label htmlFor="isPrivate">Reunión Privada</Label>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {formData.virtual && (
                          <>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="recordMeeting"
                                checked={formData.recordMeeting}
                                onCheckedChange={(checked) => handleInputChange('recordMeeting', checked)}
                              />
                              <Label htmlFor="recordMeeting">Grabar Reunión</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="enableChat"
                                checked={formData.enableChat}
                                onCheckedChange={(checked) => handleInputChange('enableChat', checked)}
                              />
                              <Label htmlFor="enableChat">Habilitar Chat</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="enableScreenShare"
                                checked={formData.enableScreenShare}
                                onCheckedChange={(checked) => handleInputChange('enableScreenShare', checked)}
                              />
                              <Label htmlFor="enableScreenShare">Habilitar Compartir Pantalla</Label>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Max Participants */}
                  <div className="space-y-2">
                    <Label htmlFor="maxParticipants">Número Máximo de Participantes</Label>
                    <Input
                      id="maxParticipants"
                      type="number"
                      min="2"
                      max="100"
                      value={formData.maxParticipants}
                      onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value))}
                    />
                  </div>

                  {/* Recurring */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isRecurring"
                        checked={formData.isRecurring}
                        onCheckedChange={(checked) => handleInputChange('isRecurring', checked)}
                      />
                      <Label htmlFor="isRecurring">Reunión Recurrente</Label>
                    </div>

                    {formData.isRecurring && (
                      <div className="space-y-2">
                        <Label htmlFor="recurrenceRule">Regla de Recurrencia</Label>
                        <Textarea
                          id="recurrenceRule"
                          value={formData.recurrenceRule}
                          onChange={(e) => handleInputChange('recurrenceRule', e.target.value)}
                          placeholder="Ej: FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10"
                          rows={2}
                        />
                        <p className="text-sm text-muted-foreground">
                          Formato RRULE para especificar la recurrencia
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Crear Reunión
                  </>
                )}
              </Button>
            </div>
          </Tabs>
        </form>
      </div>
    </ResponsiveContainer>
  )
}