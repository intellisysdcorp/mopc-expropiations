'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-hot-toast'
import {
  Upload,
  File,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Plus
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface CaseCreationDocument {
  file: File
  title: string
  description: string
  documentType: string
  category: string
  securityLevel: string
  tags: string
  uploadProgress?: number
  uploadStatus?: 'pending' | 'uploading' | 'complete' | 'error'
  uploadError?: string
  documentId?: string
}

interface CaseCreationDocumentsProps {
  documents: CaseCreationDocument[]
  onDocumentsChange: (documents: CaseCreationDocument[]) => void
  maxFiles?: number
  disabled?: boolean
}

const DOCUMENT_TYPES = [
  { value: 'LEGAL', label: 'Legal', icon: FileText, color: 'bg-blue-100 text-blue-800' },
  { value: 'EVIDENCE', label: 'Evidencia', icon: FileText, color: 'bg-orange-100 text-orange-800' },
  { value: 'REPORT', label: 'Reporte', icon: FileText, color: 'bg-green-100 text-green-800' },
  { value: 'PHOTO', label: 'Foto', icon: Image, color: 'bg-purple-100 text-purple-800' },
  { value: 'VIDEO', label: 'Video', icon: Video, color: 'bg-red-100 text-red-800' },
  { value: 'AUDIO', label: 'Audio', icon: Music, color: 'bg-indigo-100 text-indigo-800' },
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

const SECURITY_LEVELS = [
  { value: 'PUBLIC', label: 'Público' },
  { value: 'INTERNAL', label: 'Interno' },
  { value: 'CONFIDENTIAL', label: 'Confidencial' },
  { value: 'RESTRICTED', label: 'Restringido' },
]

export function CaseCreationDocuments({
  documents,
  onDocumentsChange,
  maxFiles = 10,
  disabled = false
}: CaseCreationDocumentsProps) {
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    documentType: 'OTHER',
    category: 'OTHER',
    securityLevel: 'INTERNAL',
    tags: '',
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled) return

    const validFiles = acceptedFiles.filter(file => {
      const isValidSize = file.size <= 100 * 1024 * 1024 // 100MB
      const isValidType = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'text/plain',
        'text/csv',
        'application/zip'
      ].includes(file.type)

      if (!isValidSize) {
        toast.error(`Archivo ${file.name} es demasiado grande (máximo 100MB)`)
        return false
      }

      if (!isValidType) {
        toast.error(`Archivo ${file.name} no está permitido`)
        return false
      }

      return true
    })

    if (documents.length + validFiles.length > maxFiles) {
      toast.error(`Solo puedes subir un máximo de ${maxFiles} archivos`)
      return
    }

    // Process each file
    validFiles.forEach(file => {
      setCurrentFile(file)
      setIsDialogOpen(true)
      setFormData(prev => ({
        ...prev,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      }))
    })
  }, [disabled, documents.length, maxFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    maxFiles: maxFiles - documents.length,
    multiple: true,
  })

  const handleDocumentAdd = () => {
    if (!currentFile || !formData.title.trim()) {
      toast.error('Por favor completa el título del documento')
      return
    }

    const newDocument: CaseCreationDocument = {
      file: currentFile,
      title: formData.title,
      description: formData.description,
      documentType: formData.documentType,
      category: formData.category,
      securityLevel: formData.securityLevel,
      tags: formData.tags,
      uploadStatus: 'pending'
    }

    onDocumentsChange([...documents, newDocument])

    setIsDialogOpen(false)
    setCurrentFile(null)
    setFormData({
      title: '',
      description: '',
      documentType: 'OTHER',
      category: 'OTHER',
      securityLevel: 'INTERNAL',
      tags: '',
    })
  }

  const removeDocument = (index: number) => {
    onDocumentsChange(documents.filter((_, i) => i !== index))
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image
    if (file.type.startsWith('video/')) return Video
    if (file.type.startsWith('audio/')) return Music
    if (file.type.includes('zip') || file.type.includes('rar')) return Archive
    return File
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'complete': return CheckCircle
      case 'error': return AlertCircle
      case 'uploading': return Loader2
      default: return File
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'complete': return 'text-green-600'
      case 'error': return 'text-red-600'
      case 'uploading': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getDocumentTypeConfig = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type) || DOCUMENT_TYPES[13]
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Documentos del Caso
          </CardTitle>
          <CardDescription>
            Sube documentos relacionados con el caso. Se aceptan PDF, imágenes, documentos de Office y archivos comprimidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${disabled || documents.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-lg font-medium text-blue-600">
                Suelta los archivos aquí...
              </p>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Arrastra archivos aquí o haz clic para seleccionar
                </p>
                <p className="text-sm text-gray-500">
                  {documents.length}/{maxFiles} archivos subidos, máximo 100MB por archivo
                </p>
              </div>
            )}
          </div>

          {/* Document List */}
          {documents.length > 0 && (
            <div className="mt-6 space-y-3">
              <Label>Documentos agregados ({documents.length})</Label>
              <ScrollArea className="h-64">
                {documents.map((doc, index) => {
                  const FileIcon = getFileIcon(doc.file)
                  const StatusIcon = getStatusIcon(doc.uploadStatus)
                  const StatusColor = getStatusColor(doc.uploadStatus)
                  const typeConfig = getDocumentTypeConfig(doc.documentType)

                  return (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg mb-2">
                      <FileIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                          <div className="flex items-center gap-2">
                            {doc.uploadStatus === 'uploading' && doc.uploadProgress && (
                              <span className="text-xs text-blue-600">{doc.uploadProgress}%</span>
                            )}
                            <StatusIcon className={`h-4 w-4 ${StatusColor} ${
                              doc.uploadStatus === 'uploading' ? 'animate-spin' : ''
                            }`} />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {doc.file.name} • {(doc.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={typeConfig.color}>
                            {typeConfig.label}
                          </Badge>
                          {doc.uploadStatus === 'complete' && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Subido
                            </Badge>
                          )}
                          {doc.uploadStatus === 'error' && (
                            <Badge variant="outline" className="text-xs text-red-600">
                              Error
                            </Badge>
                          )}
                        </div>
                        {doc.uploadStatus === 'uploading' && (
                          <Progress value={doc.uploadProgress || 0} className="mt-2" />
                        )}
                        {doc.uploadStatus === 'error' && doc.uploadError && (
                          <p className="text-xs text-red-600 mt-1">{doc.uploadError}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeDocument(index)}
                        disabled={doc.uploadStatus === 'uploading'}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Documento</DialogTitle>
            <DialogDescription>
              Completa la información para {currentFile?.name}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ingresa un título descriptivo"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe el contenido del documento"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="documentType">Tipo de Documento *</Label>
                    <Select
                      value={formData.documentType}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, documentType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map(type => (
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

                  <div>
                    <Label htmlFor="category">Categoría *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona la categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(category => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="securityLevel">Nivel de Seguridad *</Label>
                  <Select
                    value={formData.securityLevel}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, securityLevel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el nivel de seguridad" />
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

                <div>
                  <Label htmlFor="tags">Etiquetas</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="Separadas por comas: importante, contrato, legal"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Separa las etiquetas con comas
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleDocumentAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Documento
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}