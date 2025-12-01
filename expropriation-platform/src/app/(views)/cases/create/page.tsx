'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { CaseFormModular } from '@/components/dynamic'
import clientLogger from '@/lib/client-logger';

export default function CreateCasePage() {
  const { status } = useSession()
  const router = useRouter()

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-10 w-10 animate-pulse bg-muted rounded" />
          <div>
            <div className="h-8 w-64 mb-2 animate-pulse bg-muted rounded" />
            <div className="h-4 w-96 animate-pulse bg-muted rounded" />
          </div>
        </div>
        <div className="grid gap-6">
          <div className="h-96 w-full animate-pulse bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const handleSave = async (data: any) => {
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create case')
      }

      router.push('/cases')
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error creating case:', error)
      }
      // Re-throw to let the form component handle the error display
      throw error
    }
  }

  const handleCancel = () => {
    router.push('/cases')
  }

  return <CaseFormModular mode="create" onSave={handleSave} onCancel={handleCancel} />
}