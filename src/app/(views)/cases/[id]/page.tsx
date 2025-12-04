'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, FolderOpen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Document } from '@/types/client'
import { useCase } from '@/hooks/useCase'
import { getStatusConfig, getPriorityConfig } from '@/lib/case-helpers'
import { CaseStatusCards } from '@/components/cases/case-status-cards'
import { DocumentList } from '@/components/cases/document-list'
import { OverviewTab } from '@/components/cases/tabs/overview-tab'
import { PropertyTab } from '@/components/cases/tabs/property-tab'
import { OwnerTab } from '@/components/cases/tabs/owner-tab'
import { LegalTab } from '@/components/cases/tabs/legal-tab'
import { ActivityTab } from '@/components/cases/tabs/activity-tab'

function CaseDetailSkeleton() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-10 w-10" />
        <div className="flex-1">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}

export default function CaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const caseId = String(params?.id)

  const { case: caseData, loading, status } = useCase(caseId)
  const [activeTab, setActiveTab] = useState('overview')
  const [refreshTrigger] = useState(0)

  // Handle document selection
  const handleDocumentSelect = (_document: Document) => {
    // TODO: Implement document detail view or navigation
    // This would typically open a modal or navigate to a document detail page
  }

  if (status === 'loading' || loading) {
    return <CaseDetailSkeleton />
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  if (!caseData) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Caso no encontrado</h1>
          <p className="text-muted-foreground mb-4">
            El caso que buscas no existe o no tienes permisos para verlo.
          </p>
          <Button onClick={() => router.push('/cases')}>
            Volver a casos
          </Button>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(caseData.status)
  const priorityConfig = getPriorityConfig(caseData.priority)
  const documentsCount = caseData._count?.documents || 0;

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/cases')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{caseData.fileNumber}</h1>
            <p className="text-muted-foreground">{caseData.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/cases/${caseData.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* Status and Progress */}
      <CaseStatusCards
        caseData={caseData}
        statusConfig={statusConfig}
        priorityConfig={priorityConfig}
      />

      {/* Case Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="property">Propiedad</TabsTrigger>
          <TabsTrigger value="owner">Propietario</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
          <TabsTrigger value="documents">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Documentos
              {documentsCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {documentsCount}
                </Badge>
              )}
            </div>
          </TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab caseData={caseData} />
        </TabsContent>

        <TabsContent value="property">
          <PropertyTab caseData={caseData} />
        </TabsContent>

        <TabsContent value="owner">
          <OwnerTab caseData={caseData} />
        </TabsContent>

        <TabsContent value="legal">
          <LegalTab caseData={caseData} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentList
            caseId={caseData.id}
            onDocumentSelect={handleDocumentSelect}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab caseData={caseData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}