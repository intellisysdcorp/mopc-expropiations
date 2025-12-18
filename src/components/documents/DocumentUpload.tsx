'use client';

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DocumentType, DocumentCategory, DocumentSecurityLevel } from '@/prisma/enums';
import toast from 'react-hot-toast';
import { neutralToast } from '@/lib/toast-utils';
import {
  getDocumentTypeTranslation,
  getDocumentCategoryTranslation,
  getDocumentSecurityLevelTranslation
} from '@/lib/document-constants';

interface DocumentUploadProps {
  onUploadComplete?: (documents: any[]) => void;
  maxFiles?: number;
  caseId?: string;
}

interface FileUpload {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  documentData: {
    title: string;
    description: string;
    documentType: DocumentType;
    category: DocumentCategory;
    securityLevel: DocumentSecurityLevel;
    tags: string;
    metadata: Record<string, any>;
    retentionPeriod?: number;
    expiresAt?: string;
  };
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME_TYPES = [
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
];

export function DocumentUpload({ onUploadComplete, maxFiles = 10, caseId }: DocumentUploadProps) {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach((rejected) => {
        if (rejected.errors.some((error: any) => error.code === 'file-too-large')) {
          toast.error(`El archivo "${rejected.file.name}" es demasiado grande. El tamaño máximo es 100MB.`);
        } else if (rejected.errors.some((error: any) => error.code === 'file-invalid-type')) {
          toast.error(`El archivo "${rejected.file.name}" tiene un tipo no compatible.`);
        } else {
          toast.error(`El archivo "${rejected.file.name}" fue rechazado: ${rejected.errors[0].message}`);
        }
      });
    }

    // Handle accepted files
    const newFiles: FileUpload[] = acceptedFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'pending',
      documentData: {
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        description: '',
        documentType: DocumentType.OTHER,
        category: DocumentCategory.ADMINISTRATIVE,
        securityLevel: DocumentSecurityLevel.INTERNAL,
        tags: '',
        metadata: {},
      },
    }));

    setFiles((prev) => {
      const updated = [...prev, ...newFiles];
      return updated.slice(0, maxFiles); // Limit to maxFiles
    });
  }, [maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    accept: ALLOWED_MIME_TYPES.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxFiles: maxFiles - files.length,
    disabled: isUploading,
  });

  const updateFileData = (fileId: string, field: string, value: any) => {
    setFiles((prev) =>
      prev.map((fileUpload) =>
        fileUpload.id === fileId
          ? {
              ...fileUpload,
              documentData: {
                ...fileUpload.documentData,
                [field]: value,
              },
            }
          : fileUpload
      )
    );
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((fileUpload) => fileUpload.id !== fileId));
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      toast.error('No hay archivos para cargar');
      return;
    }

    // Validate all files have required data
    const invalidFiles = files.filter(
      (fileUpload) => !fileUpload.documentData.title.trim()
    );

    if (invalidFiles.length > 0) {
      toast.error('Todos los archivos deben tener un título');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    abortControllerRef.current = new AbortController();

    const uploadedDocuments: any[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const fileUpload = files[i]!;

        // Check if upload was aborted
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        // Update file status to uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileUpload.id
              ? { ...f, status: 'uploading', progress: 0 }
              : f
          )
        );

        try {
          const formData = new FormData();
          formData.append('file', fileUpload.file);
          formData.append(
            'documentData',
            JSON.stringify({
              ...fileUpload.documentData,
              caseId,
            })
          );

          const response = await fetch('/api/documents', {
            method: 'POST',
            body: formData,
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al cargar el archivo');
          }

          const document = await response.json();
          uploadedDocuments.push(document);

          // Update file status to success
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileUpload.id
                ? { ...f, status: 'success', progress: 100 }
                : f
            )
          );

          // Update overall progress
          setUploadProgress(((i + 1) / files.length) * 100);

        } catch (error) {
          // Update file status to error
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileUpload.id
                ? {
                    ...f,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Error al cargar el archivo',
                  }
                : f
            )
          );
        }
      }

      // Complete upload
      setIsUploading(false);

      if (uploadedDocuments.length > 0) {
        toast.success(`${uploadedDocuments.length} documento(s) cargado(s) exitosamente`);
        onUploadComplete?.(uploadedDocuments);

        // Clear successful uploads after a delay
        setTimeout(() => {
          setFiles((prev) => prev.filter((f) => f.status !== 'success'));
        }, 2000);
      } else {
        toast.error('No se cargaron documentos exitosamente');
      }

    } catch (error) {
      setIsUploading(false);
      toast.error(error instanceof Error ? error.message : 'Error al cargar el archivo');
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
      neutralToast('Carga cancelada');
    }
  };

  const getStatusIcon = (status: FileUpload['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'uploading':
        return <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <Card>
        <CardHeader>
          <CardTitle>Cargar Documentos</CardTitle>
          <CardDescription>
            Arrastre y suelte archivos aquí, o haga clic para seleccionar archivos. Máximo {maxFiles} archivos, 100MB cada uno.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive
                ? 'Suelte los archivos aquí...'
                : 'Arrastre y suelte archivos aquí, o haga clic para seleccionar'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Formatos compatibles: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, GIF, WebP, TXT, CSV
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Archivos para Cargar</CardTitle>
            <CardDescription>
              Configure los detalles del documento para cada archivo antes de cargarlo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((fileUpload) => (
              <div key={fileUpload.id} className="border rounded-lg p-4 space-y-4">
                {/* File Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(fileUpload.status)}
                    <div className="flex items-center space-x-2">
                      <File className="h-5 w-5 text-gray-500" />
                      <span className="font-medium">{fileUpload.file.name}</span>
                      <Badge variant="secondary">{formatFileSize(fileUpload.file.size)}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(fileUpload.id)}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Progress */}
                {fileUpload.status === 'uploading' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Cargando...</span>
                      <span>{fileUpload.progress}%</span>
                    </div>
                    <Progress value={fileUpload.progress} />
                  </div>
                )}

                {/* Error */}
                {fileUpload.status === 'error' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{fileUpload.error}</AlertDescription>
                  </Alert>
                )}

                {/* Document Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`title-${fileUpload.id}`}>Título *</Label>
                    <Input
                      id={`title-${fileUpload.id}`}
                      value={fileUpload.documentData.title}
                      onChange={(e) => updateFileData(fileUpload.id, 'title', e.target.value)}
                      disabled={isUploading}
                      placeholder="Título del documento"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`type-${fileUpload.id}`}>Tipo de Documento</Label>
                    <Select
                      value={fileUpload.documentData.documentType}
                      onValueChange={(value: DocumentType) =>
                        updateFileData(fileUpload.id, 'documentType', value)
                      }
                      disabled={isUploading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(DocumentType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {getDocumentTypeTranslation(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`category-${fileUpload.id}`}>Categoría</Label>
                    <Select
                      value={fileUpload.documentData.category}
                      onValueChange={(value: DocumentCategory) =>
                        updateFileData(fileUpload.id, 'category', value)
                      }
                      disabled={isUploading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(DocumentCategory).map((category) => (
                          <SelectItem key={category} value={category}>
                            {getDocumentCategoryTranslation(category)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`security-${fileUpload.id}`}>Nivel de Seguridad</Label>
                    <Select
                      value={fileUpload.documentData.securityLevel}
                      onValueChange={(value: DocumentSecurityLevel) =>
                        updateFileData(fileUpload.id, 'securityLevel', value)
                      }
                      disabled={isUploading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(DocumentSecurityLevel).map((level) => (
                          <SelectItem key={level} value={level}>
                            {getDocumentSecurityLevelTranslation(level)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`description-${fileUpload.id}`}>Descripción</Label>
                    <Textarea
                      id={`description-${fileUpload.id}`}
                      value={fileUpload.documentData.description}
                      onChange={(e) => updateFileData(fileUpload.id, 'description', e.target.value)}
                      disabled={isUploading}
                      placeholder="Descripción del documento"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`tags-${fileUpload.id}`}>Etiquetas</Label>
                    <Input
                      id={`tags-${fileUpload.id}`}
                      value={fileUpload.documentData.tags}
                      onChange={(e) => updateFileData(fileUpload.id, 'tags', e.target.value)}
                      disabled={isUploading}
                      placeholder="Ingrese etiquetas separadas por comas"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Upload Controls */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-500">
                {files.length} archivo(s) seleccionado(s)
              </div>
              <div className="space-x-2">
                {isUploading ? (
                  <Button variant="outline" onClick={cancelUpload}>
                    Cancelar Carga
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setFiles([])}
                      disabled={files.length === 0}
                    >
                      Limpiar Todo
                    </Button>
                    <Button
                      onClick={uploadFiles}
                      disabled={files.length === 0 || isUploading}
                    >
                      Cargar {files.length} Documento{files.length !== 1 ? 's' : ''}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Overall Progress */}
            {isUploading && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span>Progreso General</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}