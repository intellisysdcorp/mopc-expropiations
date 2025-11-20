'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Search, RefreshCw, Calendar, Clock, Users, Video, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveContainer } from '@/components/ui/responsive-container'
import { toast } from 'react-hot-toast'

import clientLogger from '@/lib/client-logger';
import { Meeting, MeetingSearchInput } from '@/types/client'

const MEETING_STATUSES = [
  { value: 'DRAFT', label: 'Borrador', color: 'bg-gray-100 text-gray-800' },
  { value: 'SCHEDULED', label: 'Programada', color: 'bg-blue-100 text-blue-800' },
  { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-orange-100 text-orange-800' },
  { value: 'COMPLETED', label: 'Completada', color: 'bg-green-100 text-green-800' },
  { value: 'CANCELLED', label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  { value: 'POSTPONED', label: 'Pospuesta', color: 'bg-yellow-100 text-yellow-800' }
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

export default function MeetingsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })
  const [searchParams, setSearchParams] = useState<MeetingSearchInput>({
    page: 1,
    limit: 20,
    sortBy: 'scheduledStartTime',
    sortOrder: 'asc'
  })
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchParams.query || '')
    }, 300)

    return () => clearTimeout(timer)
  }, [searchParams.query])

  // Fetch meetings
  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true)
      const params = getSanitizedMeetingParams(searchParams);
      if (debouncedQuery) {
        params.set('query', debouncedQuery)
      }

      const response = await fetch(`/api/meetings?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch meetings')
      }

      const data = await response.json()
      setMeetings(data.meetings)
      setPagination(data.pagination)
    } catch (error) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching meetings:', error)
        toast.error('Error al cargar las reuniones')
      }
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, searchParams])

  // Fetch meetings when search params change
  useEffect(() => {
    if (status === 'authenticated') {
      fetchMeetings()
    }
  }, [status, debouncedQuery, searchParams, fetchMeetings])

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchParams(prev => ({
      ...prev,
      query: value,
      page: 1
    }))
  }

  // Handle filter changes
  const handleFilterChange = (key: keyof MeetingSearchInput, value: any) => {
    setSearchParams(prev => ({
      ...prev,
      [key]: value,
      page: 1
    }))
  }

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig = MEETING_STATUSES.find(s => s.value === status)
    if (!statusConfig) return <Badge variant="secondary">{status}</Badge>
    return <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
  }

  // Get type badge
  const getTypeBadge = (type: string) => {
    const typeConfig = MEETING_TYPES.find(t => t.value === type)
    if (!typeConfig) return <Badge variant="outline">{type}</Badge>
    return <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
  }

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    const priorityConfig = PRIORITIES.find(p => p.value === priority)
    if (!priorityConfig) return <Badge variant="secondary">{priority}</Badge>
    return <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
  }

  if (status === 'loading' || loading) {
    return (
      <ResponsiveContainer size="xl" padding="lg">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Reuniones</h1>
              <p className="text-muted-foreground">Gestión de reuniones del sistema</p>
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="flex space-x-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Reuniones</h1>
            <p className="text-muted-foreground">Gestión de reuniones del sistema</p>
          </div>
          <Button onClick={() => router.push('/meetings/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Reunión
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar reuniones..."
                value={searchParams.query || ''}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={searchParams.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {MEETING_STATUSES.map(status => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={searchParams.meetingType || 'all'} onValueChange={(value) => handleFilterChange('meetingType', value === 'all' ? '' : value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {MEETING_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={searchParams.virtual !== undefined ? searchParams.virtual.toString() : 'all'} onValueChange={(value) => handleFilterChange('virtual', value === 'all' ? undefined : value === 'true' ? true : false)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Modalidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="true">Virtual</SelectItem>
              <SelectItem value="false">Presencial</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchMeetings}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Meetings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reuniones ({pagination.total})</CardTitle>
            <CardDescription>
              Lista de todas las reuniones programadas y realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {meetings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay reuniones</h3>
                <p className="text-muted-foreground mb-4">
                  {searchParams.query || searchParams.status || searchParams.meetingType
                    ? 'No se encontraron reuniones con los filtros seleccionados.'
                    : 'Aún no hay reuniones programadas.'
                  }
                </p>
                <Button onClick={() => router.push('/meetings/create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Reunión
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fecha y Hora</TableHead>
                      <TableHead>Modalidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Participantes</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meetings.map((meeting) => (
                      <TableRow key={meeting.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium">{meeting.title}</div>
                            {meeting.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-xs">
                                {meeting.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(meeting.meetingType)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {formatDate(meeting.scheduledStartTime)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {meeting.virtual ? (
                              <>
                                <Video className="h-4 w-4 text-blue-600" />
                                <span className="text-sm">Virtual</span>
                              </>
                            ) : (
                              <>
                                <MapPin className="h-4 w-4 text-green-600" />
                                <span className="text-sm">Presencial</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(meeting.status)}</TableCell>
                        <TableCell>{getPriorityBadge(meeting.priority)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {meeting.attendedCount}/{meeting.invitedCount}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/meetings/${meeting.id}`)}
                          >
                            Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} reuniones
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchParams(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Página {pagination.page} de {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchParams(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.pages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveContainer>
  )
}

function getSanitizedMeetingParams(searchParams: MeetingSearchInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', searchParams.page.toString())
  params.set('limit', searchParams.limit.toString())

  // Add string parameters
  if (searchParams.query) params.set('query', searchParams.query)
  if (searchParams.meetingType) params.set('meetingType', searchParams.meetingType)
  if (searchParams.status) params.set('status', searchParams.status)
  if (searchParams.priority) params.set('priority', searchParams.priority)
  if (searchParams.departmentId) params.set('departmentId', searchParams.departmentId)
  if (searchParams.organizerId) params.set('organizerId', searchParams.organizerId)
  if (searchParams.chairId) params.set('chairId', searchParams.chairId)
  if (searchParams.caseId) params.set('caseId', searchParams.caseId)

  // Add boolean parameters
  if (searchParams.virtual !== undefined) params.set('virtual', searchParams.virtual.toString())
  if (searchParams.isRecurring !== undefined) params.set('isRecurring', searchParams.isRecurring.toString())

  // Add Date parameters
  if (searchParams.scheduledStartTimeFrom) {
    params.set('scheduledStartTimeFrom', searchParams.scheduledStartTimeFrom.toISOString())
  }
  if (searchParams.scheduledStartTimeTo) {
    params.set('scheduledStartTimeTo', searchParams.scheduledStartTimeTo.toISOString())
  }

  // Add sorting parameters
  params.set('sortBy', searchParams.sortBy)
  if (searchParams.sortOrder) params.set('sortOrder', searchParams.sortOrder)
  
  return params;
}