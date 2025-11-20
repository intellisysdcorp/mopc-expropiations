'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Edit,
  Users,
  Calendar,
  Clock,
  Video,
  MapPin,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Share,
  MoreHorizontal,
  Settings
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveContainer } from '@/components/ui/responsive-container'
import { toast } from 'react-hot-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import clientLogger from '@/lib/client-logger';

import { Meeting } from '@/types/client'

const MEETING_STATUSES = [
  { value: 'DRAFT', label: 'Borrador', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
  { value: 'SCHEDULED', label: 'Programada', color: 'bg-blue-100 text-blue-800', icon: Calendar },
  { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-orange-100 text-orange-800', icon: Clock },
  { value: 'COMPLETED', label: 'Completada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  { value: 'CANCELLED', label: 'Cancelada', color: 'bg-red-100 text-red-800', icon: XCircle },
  { value: 'POSTPONED', label: 'Pospuesta', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle }
]

const MEETING_TYPES = [
  { value: 'SITE_VISIT', label: 'Visita al Sitio', color: 'bg-green-100 text-green-800' },
  { value: 'COORDINATION', label: 'Coordinación', color: 'bg-blue-100 text-blue-800' },
  { value: 'DECISION', label: 'Decisión', color: 'bg-purple-100 text-purple-800' },
  { value: 'TECHNICAL_REVIEW', label: 'Revisión Técnica', color: 'bg-orange-100 text-orange-800' },
  { value: 'NEGOTIATION', label: 'Negociación', color: 'bg-red-100 text-red-800' },
  { value: 'PUBLIC_HEARING', label: 'Audiencia Pública', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'INTERNAL', label: 'Interna', color: 'bg-gray-100 text-gray-800' },
  { value: 'EXTERNAL', label: 'Externa', color: 'bg-cyan-100 text-cyan-800' }
]

const PRIORITIES = [
  { value: 'LOW', label: 'Baja', color: 'bg-gray-100 text-gray-800' },
  { value: 'MEDIUM', label: 'Media', color: 'bg-blue-100 text-blue-800' },
  { value: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'URGENT', label: 'Urgente', color: 'bg-red-100 text-red-800' }
]

export default function MeetingDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const meetingId = params?.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch meeting details
  const fetchMeeting = useCallback(async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Reunión no encontrada')
          router.push('/meetings')
          return
        }
        throw new Error('Failed to fetch meeting')
      }

      const data = await response.json()
      setMeeting(data)
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching meeting:', error)
        toast.error('Error al cargar los detalles de la reunión')  
      }
      router.push('/meetings')
    } finally {
      setLoading(false)
    }
  }, [meetingId, router])

  useEffect(() => {
    if (status === 'authenticated' && meetingId) {
      fetchMeeting()
    }
  }, [status, meetingId, fetchMeeting])

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Santo_Domingo'
    }).format(new Date(date))
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig = MEETING_STATUSES.find(s => s.value === status)
    if (!statusConfig) {
      return <Badge variant="secondary">{status}</Badge>
    }
    const Icon = statusConfig.icon
    return (
      <Badge className={statusConfig.color}>
        <Icon className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
    )
  }

  // Get type badge
  const getTypeBadge = (type: string) => {
    const typeConfig = MEETING_TYPES.find(t => t.value === type)
    if (!typeConfig) {
      return <Badge variant="outline">{type}</Badge>
    }
    return <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
  }

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    const priorityConfig = PRIORITIES.find(p => p.value === priority)
    if (!priorityConfig) {
      return <Badge variant="secondary">{priority}</Badge>
    }
    return <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
  }

  // Join meeting
  const handleJoinMeeting = () => {
    if (meeting?.meetingUrl) {
      window.open(meeting.meetingUrl, '_blank')
    }
  }

  // Delete meeting
  const handleDeleteMeeting = async () => {
    if (!confirm('¿Está seguro de que desea eliminar esta reunión? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete meeting')
      }

      toast.success('Reunión eliminada exitosamente')
      router.push('/meetings')
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error deleting meeting:', error)
        toast.error('Error al eliminar la reunión')
      }
    }
  }

  if (status === 'loading' || loading) {
    return (
      <ResponsiveContainer size="xl" padding="lg">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </ResponsiveContainer>
    )
  }

  if (!meeting) {
    return (
      <ResponsiveContainer size="xl" padding="lg">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Reunión no encontrada</h3>
          <p className="text-muted-foreground mb-4">
            La reunión que busca no existe o no tiene permisos para verla.
          </p>
          <Button onClick={() => router.push('/meetings')}>
            Volver a Reuniones
          </Button>
        </div>
      </ResponsiveContainer>
    )
  }

  const canEdit = session?.user?.role === 'SUPER_ADMIN' ||
                 session?.user?.role === 'DEPARTMENT_ADMIN' ||
                 meeting.organizerId === session?.user?.id

  return (
    <ResponsiveContainer size="xl" padding="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              <h1 className="text-3xl font-bold">{meeting.title}</h1>
              <p className="text-muted-foreground">
                {getTypeBadge(meeting.meetingType)} • {formatDate(meeting.scheduledStartTime)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Join Meeting Button */}
            {meeting.status === 'IN_PROGRESS' && meeting.virtual && (
              <Button onClick={handleJoinMeeting}>
                <Video className="h-4 w-4 mr-2" />
                Unirse a la Reunión
              </Button>
            )}

            {/* Edit Button */}
            {canEdit && (
              <Button variant="outline" onClick={() => router.push(`/meetings/${meeting.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}

            {/* More Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Share className="h-4 w-4 mr-2" />
                  Compartir
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {canEdit && (
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={handleDeleteMeeting}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meeting Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Estado</p>
                  <p>{getStatusBadge(meeting.status)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Prioridad</p>
                  <p>{getPriorityBadge(meeting.priority)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Participantes</p>
                  <p className="text-sm">{meeting.attendedCount}/{meeting.invitedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                {meeting.virtual ? (
                  <Video className="h-4 w-4 text-blue-600" />
                ) : (
                  <MapPin className="h-4 w-4 text-green-600" />
                )}
                <div>
                  <p className="text-sm font-medium">Modalidad</p>
                  <p className="text-sm">{meeting.virtual ? 'Virtual' : 'Presencial'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="participants">Participantes</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="decisions">Decisiones</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Description */}
                <Card>
                  <CardHeader>
                    <CardTitle>Descripción</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {meeting.description ? (
                      <p className="text-sm">{meeting.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay descripción disponible.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Meeting Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Detalles de la Reunión</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Fecha y Hora Inicio</Label>
                        <p className="text-sm">{formatDate(meeting.scheduledStartTime)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Fecha y Hora Fin</Label>
                        <p className="text-sm">{formatDate(meeting.scheduledEndTime)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Zona Horaria</Label>
                        <p className="text-sm">{meeting.timezone}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Organizador</Label>
                        <p className="text-sm">{meeting.organizer?.name}</p>
                      </div>
                      {meeting.chair && (
                        <div>
                          <Label className="text-sm font-medium">Presidente</Label>
                          <p className="text-sm">{meeting.chair.name}</p>
                        </div>
                      )}
                      {meeting.case && (
                        <div>
                          <Label className="text-sm font-medium">Caso Relacionado</Label>
                          <p className="text-sm">{meeting.case.fileNumber} - {meeting.case.title}</p>
                        </div>
                      )}
                    </div>

                    {meeting.virtual ? (
                      <div>
                        <Label className="text-sm font-medium">URL de la Reunión</Label>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-blue-600">{meeting.meetingUrl}</p>
                          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(meeting.meetingUrl || '')}>
                            Copiar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label className="text-sm font-medium">Ubicación</Label>
                        <p className="text-sm">{meeting.location}</p>
                      </div>
                    )}

                    {meeting.tags && (
                      <div>
                        <Label className="text-sm font-medium">Etiquetas</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {meeting.tags.split(',').map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag.trim()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Settings className="h-4 w-4" />
                      <span>Configuración</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Permitir Invitados</span>
                      <Badge variant={meeting.allowGuests ? "default" : "secondary"}>
                        {meeting.allowGuests ? 'Sí' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Requerir Aprobación</span>
                      <Badge variant={meeting.requireApproval ? "default" : "secondary"}>
                        {meeting.requireApproval ? 'Sí' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Reunión Privada</span>
                      <Badge variant={meeting.isPrivate ? "default" : "secondary"}>
                        {meeting.isPrivate ? 'Sí' : 'No'}
                      </Badge>
                    </div>
                    {meeting.virtual && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Grabar Reunión</span>
                          <Badge variant={meeting.recordMeeting ? "default" : "secondary"}>
                            {meeting.recordMeeting ? 'Sí' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Chat Habilitado</span>
                          <Badge variant={meeting.enableChat ? "default" : "secondary"}>
                            {meeting.enableChat ? 'Sí' : 'No'}
                          </Badge>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Estadísticas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Participantes Invitados</span>
                      <span className="text-sm font-medium">{meeting.invitedCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Participantes Asistieron</span>
                      <span className="text-sm font-medium">{meeting.attendedCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Items de Agenda</span>
                      <span className="text-sm font-medium">{meeting._count?.agendaItems || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Decisiones</span>
                      <span className="text-sm font-medium">{meeting._count?.decisions || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Documentos</span>
                      <span className="text-sm font-medium">{meeting._count?.documents || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Participants Tab */}
          <TabsContent value="participants">
            <Card>
              <CardHeader>
                <CardTitle>Participantes</CardTitle>
                <CardDescription>
                  Lista de participantes invitados a la reunión
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Gestión de Participantes</h3>
                  <p className="text-muted-foreground mb-4">
                    La funcionalidad de gestión de participantes estará disponible próximamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agenda Tab */}
          <TabsContent value="agenda">
            <Card>
              <CardHeader>
                <CardTitle>Agenda de la Reunión</CardTitle>
                <CardDescription>
                  Items a tratar durante la reunión
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Gestión de Agenda</h3>
                  <p className="text-muted-foreground mb-4">
                    La funcionalidad de agenda estará disponible próximamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documentos</CardTitle>
                <CardDescription>
                  Documentos relacionados con la reunión
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Gestión de Documentos</h3>
                  <p className="text-muted-foreground mb-4">
                    La funcionalidad de documentos estará disponible próximamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Decisions Tab */}
          <TabsContent value="decisions">
            <Card>
              <CardHeader>
                <CardTitle>Decisiones</CardTitle>
                <CardDescription>
                  Decisiones tomadas durante la reunión
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Gestión de Decisiones</h3>
                  <p className="text-muted-foreground mb-4">
                    La funcionalidad de decisiones estará disponible próximamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ResponsiveContainer>
  )
}