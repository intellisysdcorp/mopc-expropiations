'use client'

import clientLogger from '@/lib/client-logger';
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Search, RefreshCw, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'react-hot-toast'

import { Case, CaseSearchInput } from '@/types/client'
import { calculateProgressPercentage } from '@/lib/stage-utils'

const CASE_STATUSES = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'EN_PROGRESO', label: 'En Progreso', color: 'bg-blue-100 text-blue-800' },
  { value: 'COMPLETADO', label: 'Completado', color: 'bg-green-100 text-green-800' },
  { value: 'SUSPENDED', label: 'Suspendido', color: 'bg-orange-100 text-orange-800' },
  { value: 'CANCELLED', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  { value: 'ARCHIVED', label: 'Archivado', color: 'bg-gray-100 text-gray-800' }
]

const PRIORITIES = [
  { value: 'LOW', label: 'Baja', color: 'bg-gray-100 text-gray-800' },
  { value: 'MEDIUM', label: 'Media', color: 'bg-blue-100 text-blue-800' },
  { value: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'URGENT', label: 'Urgente', color: 'bg-red-100 text-red-800' }
]

export default function CasesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })
  const [searchParams, setSearchParams] = useState<CaseSearchInput>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchParams.query || '')
    }, 300)

    return () => clearTimeout(timer)
  }, [searchParams.query])

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true)

      // Build URL parameters, filtering out undefined values and converting Dates to strings
      const paramsObj = {
        ...searchParams,
        query: debouncedQuery,
        page: searchParams.page.toString(),
        limit: searchParams.limit.toString()
      }

      // Filter out undefined values and convert Date objects to ISO strings
      const cleanedParams: Record<string, string> = {}
      Object.entries(paramsObj).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (value instanceof Date) {
            cleanedParams[key] = value.toISOString()
          } else {
            cleanedParams[key] = String(value)
          }
        }
      })

      const params = new URLSearchParams(cleanedParams)

      const response = await fetch(`/api/cases?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch cases')
      }

      const data = await response.json()
      setCases(data.cases)
      setPagination(data.pagination)
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching cases:', error)
        toast.error('Error al cargar los casos')
      }
    } finally {
      setLoading(false)
    }
  }, [searchParams, debouncedQuery])

  // Fetch cases when search params change
  useEffect(() => {
    if (status === 'authenticated') {
      fetchCases()
    }
  }, [status, debouncedQuery, searchParams, fetchCases])

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchParams(prev => ({ ...prev, query: value, page: 1 }))
  }

  // Handle filter change
  const handleFilterChange = (key: keyof CaseSearchInput, value: any) => {
    setSearchParams(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    setSearchParams(prev => ({ ...prev, page }))
  }

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const statusConfig = CASE_STATUSES.find(s => s.value === status)
    return statusConfig || { label: status, color: 'bg-gray-100 text-gray-800' }
  }

  // Get priority badge color
  const getPriorityBadge = (priority: string) => {
    const priorityConfig = PRIORITIES.find(p => p.value === priority)
    return priorityConfig || { label: priority, color: 'bg-gray-100 text-gray-800' }
  }

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Casos</h1>
          <p className="text-muted-foreground">
            Administra y supervisa todos los casos de expropiación
          </p>
        </div>
        <Button
          onClick={() => router.push('/cases/create')}
          size="lg"
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="mr-2 h-5 w-5" />
          Crear Nuevo Caso
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por número, título, propietario o dirección..."
                  value={searchParams.query || ''}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <Select
                value={searchParams.status || 'ALL'}
                onValueChange={(value) => handleFilterChange('status', value === 'ALL' ? undefined : value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  {CASE_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={searchParams.priority || 'ALL'}
                onValueChange={(value) => handleFilterChange('priority', value === 'ALL' ? undefined : value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las prioridades</SelectItem>
                  {PRIORITIES.map(priority => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={fetchCases}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Casos ({pagination.total})
          </CardTitle>
          <CardDescription>
            Lista de casos de expropiación con filtros aplicados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No se encontraron casos con los filtros actuales
              </p>
              <Button onClick={() => router.push('/cases/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Primer Caso
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Asignado a</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Fecha límite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((case_) => (
                    <TableRow
                      key={case_.id}
                      className={`cursor-pointer hover:bg-muted/50 ${case_.isDraft ? 'bg-gray-50/30' : ''}`}
                      onClick={() => router.push(`/cases/${case_.id}`)}
                    >
                      <TableCell>
                        <Badge className={getPriorityBadge(case_.priority).color}>
                          {getPriorityBadge(case_.priority).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {case_.isDraft && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center">
                                    <FileText className="h-4 w-4 text-gray-400 cursor-help" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Este caso es un borrador</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <div>
                            <div className={`font-medium ${case_.isDraft ? 'text-gray-500 italic' : ''}`}>
                              {case_.title}
                            </div>
                            {case_.description && (
                              <div className={`text-sm truncate max-w-xs ${case_.isDraft ? 'text-gray-400' : 'text-muted-foreground'}`}>
                                {case_.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {case_.department?.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {case_.assignedTo ? (
                          <div>
                            <div className="text-sm">
                              {case_.assignedTo.name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(case_.status).color}>
                          {getStatusBadge(case_.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${calculateProgressPercentage(case_.currentStage)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {calculateProgressPercentage(case_.currentStage)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {case_.actualEndDate && formatDate(case_.actualEndDate) || <span className='text-muted-foreground'>No definida</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(pagination.page - 1) * pagination.limit + 1} a{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                    {pagination.total} casos
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}