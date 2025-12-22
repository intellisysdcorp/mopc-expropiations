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
  Eye,
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
import { Document, DocumentFormData } from '@/types/client'
import clientLogger from '@/lib/client-logger'
import { STAGE_DOCUMENT_TYPES } from '@/constants/stages';

interface DocumentUploadProps {
  caseId: string
  currentStage: string
  onUploadComplete?: (document: Document) => void
  maxFiles?: number
  disabled?: boolean
}

interface FileUploadProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
  document?: Document
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
  { value: 'LEGAL', label: 'Legal' },
  { value: 'TECHNICAL', label: 'Técnico' },
  { value: 'FINANCIAL', label: 'Financiero' },
  { value: 'ADMINISTRATIVE', label: 'Administrativo' },
  { value: 'COMMUNICATION', label: 'Comunicación' },
  { value: 'PHOTOGRAPHIC', label: 'Fotográfico' },
  { value: 'MULTIMEDIA', label: 'Multimedia' },
  { value: 'TEMPLATE', label: 'Plantilla' },
  { value: 'REFERENCE', label: 'Referencia' },
  { value: 'CORRESPONDENCE', label: 'Correspondencia' },
]

const SECURITY_LEVELS = [
  { value: 'PUBLIC', label: 'Público' },
  { value: 'INTERNAL', label: 'Interno' },
  { value: 'CONFIDENTIAL', label: 'Confidencial' },
  { value: 'RESTRICTED', label: 'Restringido' },
]

export function DocumentUpload({
  caseId,
  currentStage,
  onUploadComplete,
  maxFiles = 10,
  disabled = false
}: DocumentUploadProps) {
  const [uploads, setUploads] = useState<FileUploadProgress[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<DocumentFormData>({
    title: '',
    description: '',
    documentType: 'OTHER',
    category: 'ADMINISTRATIVE',
    securityLevel: 'INTERNAL',
    tags: '',
  })

  const suggestedTypes = STAGE_DOCUMENT_TYPES[currentStage as keyof typeof STAGE_DOCUMENT_TYPES]

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

    if (uploads.length + validFiles.length > maxFiles) {
      toast.error(`Solo puedes subir un máximo de ${maxFiles} archivos`)
      return
    }

    const newUploads: FileUploadProgress[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending',
    }))

    setUploads(prev => [...prev, ...newUploads])

    // Start upload for each file
    validFiles.forEach(file => {
      setCurrentFile(file)
      setIsDialogOpen(true)
      setFormData(prev => ({
        ...prev,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      }))
    })
  }, [disabled, uploads.length, maxFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    maxFiles,
    multiple: true,
  })

  const uploadFile = async (file: File, data: DocumentFormData) => {
    const uploadIndex = uploads.findIndex(u => u.file === file)
    if (uploadIndex === -1) return

    // Update status to uploading
    setUploads(prev => prev.map((u, i) =>
      i === uploadIndex ? { ...u, status: 'uploading', progress: 0 } : u
    ))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentData', JSON.stringify({
        ...data,
        caseId,
      }))

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploads(prev => prev.map((u, i) => {
          if (i === uploadIndex && u.progress < 90) {
            return { ...u, progress: u.progress + 10 }
          }
          return u
        }))
      }, 200)

      const response = await fetch('/api/cases/' + caseId + '/documents', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const document = await response.json()

      // Update status to complete
      setUploads(prev => prev.map((u, i) =>
        i === uploadIndex ? { ...u, status: 'complete', progress: 100, document } : u
      ))

      toast.success(`Documento ${file.name} subido exitosamente`)
      onUploadComplete?.(document)

    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Upload error:', error)
      }
      setUploads(prev => prev.map((u, i) =>
        i === uploadIndex ? {
          ...u,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        } : u
      ))
      toast.error(`Error al subir ${file.name}`)
    }
  }

  const handleUploadSubmit = () => {
    if (!currentFile || !formData.title.trim()) {
      toast.error('Por favor completa el título del documento')
      return
    }

    uploadFile(currentFile, formData)
    setIsDialogOpen(false)
    setCurrentFile(null)
    setFormData({
      title: '',
      description: '',
      documentType: 'OTHER',
      category: 'ADMINISTRATIVE',
      securityLevel: 'INTERNAL',
      tags: '',
    })
  }

  const removeUpload = (index: number) => {
    setUploads(prev => prev.filter((_, i) => i !== index))
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image
    if (file.type.startsWith('video/')) return Video
    if (file.type.startsWith('audio/')) return Music
    if (file.type.includes('zip') || file.type.includes('rar')) return Archive
    return File
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return CheckCircle
      case 'error': return AlertCircle
      case 'uploading': return Loader2
      default: return File
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600'
      case 'error': return 'text-red-600'
      case 'uploading': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Subir Documentos
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
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
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
                  Máximo {maxFiles} archivos, 100MB por archivo
                </p>
              </div>
            )}
          </div>

          {/* Suggested document types */}
          {suggestedTypes.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm font-medium">Tipos de documentos sugeridos para esta etapa:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {suggestedTypes.map(type => {
                  const typeConfig = DOCUMENT_TYPES.find(t => t.value === type)
                  if (!typeConfig) return null
                  return (
                    <Badge key={type} className={typeConfig.color}>
                      {typeConfig.icon && <typeConfig.icon className="h-3 w-3 mr-1" />}
                      {typeConfig.label}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploads.length > 0 && (
            <div className="mt-6 space-y-3">
              <Label>Archivos en proceso ({uploads.length})</Label>
              <ScrollArea className="h-48">
                {uploads.map((upload, index) => {
                  const FileIcon = getFileIcon(upload.file)
                  const StatusIcon = getStatusIcon(upload.status)
                  const StatusColor = getStatusColor(upload.status)

                  return (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                      <FileIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{upload.file.name}</p>
                          <div className="flex items-center gap-2">
                            {upload.status === 'uploading' && (
                              <span className="text-xs text-blue-600">{upload.progress}%</span>
                            )}
                            <StatusIcon className={`h-4 w-4 ${StatusColor} ${
                              upload.status === 'uploading' ? 'animate-spin' : ''
                            }`} />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {upload.status === 'uploading' && (
                          <Progress value={upload.progress} className="mt-2" />
                        )}
                        {upload.status === 'error' && (
                          <p className="text-xs text-red-600 mt-1">{upload.error}</p>
                        )}
                        {upload.status === 'complete' && upload.document && (
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {upload.document.documentType}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`/api/documents/${upload.document!.id}/preview`, '_blank')}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeUpload(index)}
                        disabled={upload.status === 'uploading'}
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
      <Dialog open={isDialogOpen}>
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
                <Button onClick={handleUploadSubmit}>
                  Subir Documento
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}