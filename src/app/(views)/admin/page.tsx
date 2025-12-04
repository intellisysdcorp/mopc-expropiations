import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { AdminDashboardSkeleton } from '@/components/admin/admin-dashboard-skeleton'
import { auth } from '@/lib/auth'

export const metadata = {
  title: 'Panel de Administración',
  description: 'Panel de administración del sistema de expropiación',
}

export default async function AdminPage() {
  const session = await auth()

  // Check if user has admin privileges
  if (!session?.user || session.user.role !== 'super_admin') {
    redirect('/unauthorized')
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600 mt-2">
          Gestión y configuración del sistema
        </p>
      </div>

      <Suspense fallback={<AdminDashboardSkeleton />}>
        <AdminDashboard />
      </Suspense>
    </div>
  )
}