import { useState } from 'react'
import { logger } from '@/lib/logger';

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

export function useDocumentSubmission() {
  const [documents, setDocuments] = useState<CaseCreationDocument[]>([])
  const [selectedExistingDocuments, setSelectedExistingDocuments] = useState<string[]>([])

  const handleDocumentUpload = async (caseId: string) => {
    const uploadPromises = documents.map(async (doc) => {
      try {
        // Update document status to uploading
        setDocuments(prev => prev.map(d =>
          d.file === doc.file ? { ...d, uploadStatus: 'uploading' as const, uploadProgress: 0 } : d
        ))

        const formData = new FormData()
        formData.append('file', doc.file)
        formData.append('documentData', JSON.stringify({
          title: doc.title,
          description: doc.description,
          documentType: doc.documentType,
          category: doc.category,
          securityLevel: doc.securityLevel,
          tags: doc.tags,
          caseId,
        }))

        // Simulate progress
        const progressInterval = setInterval(() => {
          setDocuments(prev => prev.map(d =>
            d.file === doc.file ? {
              ...d,
              uploadProgress: Math.min((d.uploadProgress || 0) + 10, 90)
            } : d
          ))
        }, 200)

        const response = await fetch(`/api/cases/${caseId}/documents`, {
          method: 'POST',
          body: formData,
        })

        clearInterval(progressInterval)

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }

        const document = await response.json()

        // Update document status to complete
        setDocuments(prev => prev.map(d =>
          d.file === doc.file ? {
            ...d,
            uploadStatus: 'complete' as const,
            uploadProgress: 100,
            documentId: document.id
          } : d
        ))

        return document
      } catch (error) {
        logger.error('Upload error:', error)

        // Update document status to error
        setDocuments(prev => prev.map(d =>
          d.file === doc.file ? {
            ...d,
            uploadStatus: 'error' as const,
            uploadError: error instanceof Error ? error.message : 'Unknown error'
          } : d
        ))

        throw error
      }
    })

    try {
      await Promise.all(uploadPromises)
      return {
        success: true,
        message: `${documents.length} documento(s) subido(s) exitosamente`,
        uploadedCount: documents.length
      }
    } catch (error) {
      return {
        success: false,
        message: 'Algunos documentos no pudieron ser subidos',
        uploadedCount: documents.filter(d => d.uploadStatus === 'complete').length
      }
    }
  }

  const linkExistingDocuments = async (caseId: string) => {
    if (selectedExistingDocuments.length === 0) {
      return { success: true, message: 'No hay documentos existentes para vincular' }
    }

    try {
      const linkPromises = selectedExistingDocuments.map(docId =>
        fetch(`/api/cases/${caseId}/documents/link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documentId: docId }),
        })
      )

      await Promise.all(linkPromises)
      return {
        success: true,
        message: `${selectedExistingDocuments.length} documento(s) existente(s) vinculado(s)`
      }
    } catch (error) {
      logger.error('Error linking existing documents:', error)
      return {
        success: false,
        message: 'Error al vincular documentos existentes'
      }
    }
  }

  return {
    documents,
    setDocuments,
    selectedExistingDocuments,
    setSelectedExistingDocuments,
    handleDocumentUpload,
    linkExistingDocuments
  }
}