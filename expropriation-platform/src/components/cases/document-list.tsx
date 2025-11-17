'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Edit,
  Search,
  Filter,
  MoreHorizontal,
  History,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  Archive,
  Lock,
  Grid3x3,
  List,
  RefreshCw,
  SortAsc,
  SortDesc
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'react-hot-toast'

import { Document } from '@/types/client'
import { formatFileSize, formatDistanceToNow } from '@/lib/utils'
import clientLogger from '@/lib/client-logger';

interface DocumentListProps {
  caseId: string
  onDocumentSelect?: (document: Document) => void
  refreshTrigger?: number
}

const DOCUMENT_TYPES = [
  { value: 'LEGAL', label: 'Legal', icon: FileText, color: 'bg-blue-100 text-blue-800' },
  { value: 'EVIDENCE', label: 'Evidencia', icon: FileText, color: 'bg-orange-100 text-orange-800' },
  { value: 'REPORT', label: 'Reporte', icon: FileText, color: 'bg-green-100 text-green-800' },
  { value: 'PHOTO', label: 'Foto', icon: FileText, color: 'bg-purple-100 text-purple-800' },
  { value: 'VIDEO', label: 'Video', icon: FileText, color: 'bg-red-100 text-red-800' },
  { value: 'AUDIO', label: 'Audio', icon: FileText, color: 'bg-indigo-100 text-indigo-800' },
  { value: 'PLAN', label: 'Plan', icon: FileText, color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PERMIT', label: 'Permiso', icon: FileText, color: 'bg-pink-100 text-pink-800' },
  { value: 'APPRAISAL', label: 'Tasación', icon: FileText, color: 'bg-teal-100 text-teal-800' },
  { value: 'CONTRACT', label: 'Contrato', icon: FileText, color: 'bg-cyan-100 text-cyan-800' },
  { value: 'CORRESPONDENCE', label: 'Correspondencia', icon: FileText, color: 'bg-lime-100 text-lime-800' },
  { value: 'FINANCIAL', label: 'Financiero', icon: FileText, color: 'bg-emerald-100 text-emerald-800' },
  { value: 'TECHNICAL', label: 'Técnico', icon: FileText, color: 'bg-slate-100 text-slate-800' },
  { value: 'OTHER', label: 'Otro', icon: FileText, color: 'bg-gray-100 text-gray-800' },
]

const CATEGORIES = [
  { value: 'ADMINISTRATIVE', label: 'Administrativo' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'TECHNICAL', label: 'Técnico' },
  { value: 'FINANCIAL', label: 'Financiero' },
  { value: 'CORRESPONDENCE', label: 'Correspondencia' },
  { value: 'EVIDENCE', label: 'Evidencia' },
  { value: 'REPORT', label: 'Reporte' },
  { value: 'PLAN', label: 'Plan' },
  { value: 'PERMIT', label: 'Permiso' },
  { value: 'OTHER', label: 'Otro' },
]

const STATUSES = [
  { value: 'DRAFT', label: 'Borrador', icon: Edit, color: 'bg-gray-100 text-gray-800' },
  { value: 'PENDING_REVIEW', label: 'Pendiente Revisión', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  { value: 'APPROVED', label: 'Aprobado', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  { value: 'REJECTED', label: 'Rechazado', icon: AlertTriangle, color: 'bg-red-100 text-red-800' },
  { value: 'ARCHIVED', label: 'Archivado', icon: Archive, color: 'bg-gray-100 text-gray-800' },
]

const SECURITY_LEVELS = [
  { value: 'PUBLIC', label: 'Público', icon: FileText, color: 'bg-green-100 text-green-800' },
  { value: 'INTERNAL', label: 'Interno', icon: FileText, color: 'bg-blue-100 text-blue-800' },
  { value: 'CONFIDENTIAL', label: 'Confidencial', icon: Lock, color: 'bg-orange-100 text-orange-800' },
  { value: 'RESTRICTED', label: 'Restringido', icon: Lock, color: 'bg-red-100 text-red-800' },
]

export function DocumentList({ caseId, onDocumentSelect, refreshTrigger }: DocumentListProps) {
  const { data: session } = useSession()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    documentType: '',
    category: '',
    status: '',
    securityLevel: '',
  })
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  })
  const [stats, setStats] = useState<any>({})

  // Fetch documents
  const fetchDocuments = async (resetPage = false) => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        page: resetPage ? '1' : pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchQuery,
        sortBy,
        sortOrder,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        ),
      })

      const response = await fetch(`/api/cases/${caseId}/documents?${params}`)
      if (!response.ok) throw new Error('Failed to fetch documents')

      const data = await response.json()
      setDocuments(data.documents)
      setPagination(data.pagination)
      setStats(data.stats || {})

      if (resetPage) {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    } catch (error) {
      clientLogger.error('Error fetching documents:', error)
      toast.error('Error al cargar los documentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [caseId, searchQuery, filters, sortBy, sortOrder, pagination.page, refreshTrigger])

  const handleDownload = async (document: Document) => {
    try {
      const response = await fetch(`/api/documents/${document.id}/download`)
      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = document.originalFileName || document.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('Documento descargado exitosamente')
    } catch (error) {
      clientLogger.error('Download error:', error)
      toast.error('Error al descargar el documento')
    }
  }

  const handlePreview = (document: Document) => {
    window.open(`/api/documents/${document.id}/preview`, '_blank')
  }

  const handleDelete = async (document: Document) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${document.title}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Delete failed')

      toast.success('Documento eliminado exitosamente')
      fetchDocuments()
    } catch (error) {
      clientLogger.error('Delete error:', error)
      toast.error('Error al eliminar el documento')
    }
  }

  const getDocumentTypeConfig = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type) || DOCUMENT_TYPES[13]
  }

  const getStatusConfig = (status: string) => {
    return STATUSES.find(s => s.value === status) || STATUSES[0]
  }

  const getSecurityConfig = (level: string) => {
    return SECURITY_LEVELS.find(s => s.value === level) || SECURITY_LEVELS[0]
  }

  const resetFilters = () => {
    setFilters({
      documentType: '',
      category: '',
      status: '',
      securityLevel: '',
    })
    setSearchQuery('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const DocumentCard = ({ document }: { document: Document }) => {
    const typeConfig = getDocumentTypeConfig(document.documentType)
    const statusConfig = getStatusConfig(document.status)
    const securityConfig = getSecurityConfig(document.securityLevel)

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <typeConfig.icon className={`h-10 w-10 p-2 rounded-lg ${typeConfig.color.split(' ')[0]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{document.title}</h3>
                  {document.isDraft && (
                    <Badge variant="outline" className="text-xs">
                      Borrador
                    </Badge>
                  )}
                </div>

                {document.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {document.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <Badge className={typeConfig.color}>
                    {typeConfig.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {formatFileSize(document.fileSize)}
                  </Badge>
                  <Badge variant="outline" className={securityConfig.color}>
                    <securityConfig.icon className="h-3 w-3 mr-1" />
                    {securityConfig.label}
                  </Badge>
                </div>

                {document.tagsRelations && document.tagsRelations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {document.tagsRelations.slice(0, 3).map(tag => (
                      <Badge key={tag.id} variant="secondary" className="text-xs">
                        #{tag.tag}
                      </Badge>
                    ))}
                    {document.tagsRelations.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{document.tagsRelations.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {document.uploadedBy?.fullName}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(document.createdAt))}
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    v{document.version}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePreview(document)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver documento</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(document)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Descargar</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onDocumentSelect?.(document)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Ver detalles
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <History className="h-4 w-4 mr-2" />
                    Ver historial
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => handleDelete(document)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Documentos del Caso</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDocuments(true)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardTitle>
          <CardDescription>
            {pagination.total} documento{pagination.total !== 1 ? 's' : ''} encontrado{pagination.total !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={resetFilters}>
              <Filter className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select
              value={filters.documentType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, documentType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.category}
              onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.securityLevel}
              onValueChange={(value) => setFilters(prev => ({ ...prev, securityLevel: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seguridad" />
              </SelectTrigger>
              <SelectContent>
                {SECURITY_LEVELS.map(level => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Ordenar por:</span>
            <Select
              value={sortBy}
              onValueChange={setSortBy}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Fecha de creación</SelectItem>
                <SelectItem value="updatedAt">Fecha de actualización</SelectItem>
                <SelectItem value="title">Título</SelectItem>
                <SelectItem value="fileSize">Tamaño</SelectItem>
                <SelectItem value="documentType">Tipo</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No se encontraron documentos</h3>
            <p className="text-muted-foreground">
              {searchQuery || Object.values(filters).some(v => v !== '')
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Sube el primer documento para este caso'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className="space-y-3">
              {documents.map(document => (
                <DocumentCard key={document.id} document={document} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map(document => (
                <DocumentCard key={document.id} document={document} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {(pagination.page - 1) * pagination.limit + 1} -{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} documentos
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm">
                  Página {pagination.page} de {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}