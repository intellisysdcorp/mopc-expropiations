'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import {
  FileText,
  Plus,
  Search,
  BookOpen,
  FileCheck,
  Clock,
  Hash
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import clientLogger from '@/lib/client-logger';

interface DocumentTemplate {
  id: string
  type: string
  title: string
  description: string
  category: string
  securityLevel: string
  content: string
  placeholders: string[]
}

interface DocumentTemplatesProps {
  caseId: string
  onDocumentCreated?: (document: any) => void
}

const TEMPLATE_TYPES = [
  { value: 'LEGAL', label: 'Legal', icon: FileText, color: 'bg-blue-100 text-blue-800' },
  { value: 'TECHNICAL', label: 'Técnico', icon: FileCheck, color: 'bg-green-100 text-green-800' },
  { value: 'FINANCIAL', label: 'Financiero', icon: FileText, color: 'bg-orange-100 text-orange-800' },
]

const CATEGORIES = [
  { value: 'ADMINISTRATIVE', label: 'Administrativo' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'TECHNICAL', label: 'Técnico' },
  { value: 'FINANCIAL', label: 'Financiero' },
]

export function DocumentTemplates({ caseId, onDocumentCreated }: DocumentTemplatesProps) {
  const { data: session } = useSession()
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [caseContext, setCaseContext] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [templateData, setTemplateData] = useState<any>({})
  const [customizations, setCustomizations] = useState({
    title: '',
    description: '',
    content: '',
  })
  const [isCreating, setIsCreating] = useState(false)

  // Fetch templates
  useEffect(() => {
    fetchTemplates()
  }, [selectedType])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedType && selectedType !== 'all') params.append('documentType', selectedType)

      const response = await fetch(`/api/cases/${caseId}/documents/templates?${params}`)
      if (!response.ok) throw new Error('Failed to fetch templates')

      const data = await response.json()
      setTemplates(data.templates)
      setCaseContext(data.caseContext)
    } catch (error) {
      clientLogger.error('Error fetching templates:', error)
      toast.error('Error al cargar las plantillas')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (template: DocumentTemplate) => {
    setSelectedTemplate(template)

    // Initialize template data with case context and empty values
    const initialData: any = { ...caseContext }
    template.placeholders.forEach(placeholder => {
      if (!initialData[placeholder]) {
        initialData[placeholder] = ''
      }
    })
    setTemplateData(initialData)

    // Initialize customizations
    setCustomizations({
      title: template.title,
      description: template.description,
      content: template.content,
    })
  }

  const handleCreateDocument = async () => {
    if (!selectedTemplate) return

    try {
      setIsCreating(true)

      const response = await fetch(`/api/cases/${caseId}/documents/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          templateData,
          customizations: {
            title: customizations.title || selectedTemplate.title,
            description: customizations.description || selectedTemplate.description,
            content: customizations.content !== selectedTemplate.content ? customizations.content : undefined,
          },
        }),
      })

      if (!response.ok) throw new Error('Failed to create document')

      const document = await response.json()
      toast.success('Documento creado exitosamente desde plantilla')
      onDocumentCreated?.(document)
      setIsCreateDialogOpen(false)
      setSelectedTemplate(null)
    } catch (error) {
      clientLogger.error('Error creating document:', error)
      toast.error('Error al crear el documento')
    } finally {
      setIsCreating(false)
    }
  }

  const getTemplateTypeConfig = (type: string) => {
    return TEMPLATE_TYPES.find(t => t.value === type) || TEMPLATE_TYPES[0]
  }

  const getSecurityLevelBadge = (level: string) => {
    const configs = {
      'PUBLIC': { label: 'Público', color: 'bg-green-100 text-green-800' },
      'INTERNAL': { label: 'Interno', color: 'bg-blue-100 text-blue-800' },
      'CONFIDENTIAL': { label: 'Confidencial', color: 'bg-orange-100 text-orange-800' },
      'RESTRICTED': { label: 'Restringido', color: 'bg-red-100 text-red-800' },
    }
    return configs[level as keyof typeof configs] || configs['INTERNAL']
  }

  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const TemplateCard = ({ template }: { template: DocumentTemplate }) => {
    const typeConfig = getTemplateTypeConfig(template.type)
    const securityConfig = getSecurityLevelBadge(template.securityLevel)

    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleTemplateSelect(template)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <typeConfig.icon className={`h-5 w-5 p-1 rounded ${typeConfig.color.split(' ')[0]}`} />
              <div>
                <CardTitle className="text-sm">{template.title}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {template.description}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              {template.category}
            </Badge>
            <Badge className={`${securityConfig.color} text-xs`}>
              {securityConfig.label}
            </Badge>
          </div>

          {template.placeholders.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" />
              {template.placeholders.length} campo{template.placeholders.length > 1 ? 's' : ''} a completar
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Plantillas de Documentos</h3>
          <p className="text-sm text-muted-foreground">
            Crea documentos rápidamente usando plantillas predefinidas
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchTemplates()}
          disabled={loading}
        >
          <Search className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar plantillas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {TEMPLATE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No se encontraron plantillas</h3>
            <p className="text-muted-foreground">
              {searchQuery || (selectedType && selectedType !== 'all')
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'No hay plantillas disponibles para este tipo de documento'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      {/* Template Creation Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Crear Documento desde Plantilla</DialogTitle>
            <DialogDescription>
              Completa los campos necesarios para generar el documento
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6">
                {/* Template Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      <span>{selectedTemplate.title}</span>
                    </div>
                    <CardDescription>{selectedTemplate.description}</CardDescription>
                  </CardHeader>
                </Card>

                {/* Customizations */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Personalización del Documento</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="docTitle">Título del Documento</Label>
                      <Input
                        id="docTitle"
                        value={customizations.title}
                        onChange={(e) => setCustomizations(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Título del documento"
                      />
                    </div>
                    <div>
                      <Label htmlFor="docDescription">Descripción</Label>
                      <Textarea
                        id="docDescription"
                        value={customizations.description}
                        onChange={(e) => setCustomizations(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Descripción del documento"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Template Data */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Información del Documento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedTemplate.placeholders.map(placeholder => (
                      <div key={placeholder}>
                        <Label htmlFor={placeholder}>
                          {placeholder.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                        <Input
                          id={placeholder}
                          value={templateData[placeholder] || ''}
                          onChange={(e) => setTemplateData(prev => ({
                            ...prev,
                            [placeholder]: e.target.value
                          }))}
                          placeholder={`Ingrese ${placeholder.toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isCreating}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateDocument} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <FileCheck className="h-4 w-4 mr-2" />
                        Crear Documento
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Selected Template Dialog Trigger */}
      {selectedTemplate && (
        <Dialog open={!!selectedTemplate && !isCreateDialogOpen}
                onOpenChange={(open) => !open && setSelectedTemplate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedTemplate.title}</DialogTitle>
              <DialogDescription>{selectedTemplate.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedTemplate.category}</Badge>
                <Badge className={getSecurityLevelBadge(selectedTemplate.securityLevel).color}>
                  {getSecurityLevelBadge(selectedTemplate.securityLevel).label}
                </Badge>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Campos a completar:</h4>
                <div className="space-y-1">
                  {selectedTemplate.placeholders.map(placeholder => (
                    <div key={placeholder} className="flex items-center gap-2 text-sm">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      {placeholder.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Usar esta plantilla
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}