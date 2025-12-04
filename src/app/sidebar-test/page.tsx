'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { SidebarTest } from '@/components/layout/sidebar-test'

export default function SidebarTestPage() {
  return (
    <ProtectedRoute>
      <SidebarTest />
    </ProtectedRoute>
  )
}