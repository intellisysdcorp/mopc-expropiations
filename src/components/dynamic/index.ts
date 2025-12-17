'use client'

import { createElement, ComponentType, ReactNode } from 'react'
import dynamic from 'next/dynamic'

// Heavy components that should be lazy-loaded
export const CaseForm = dynamic(
  () => import('@/components/cases/case-form').then(mod => ({ default: mod.CaseForm })),
  {
    loading: () => createElement('div', { className: 'animate-pulse' }, 'Loading form...'),
    ssr: false
  }
)

export const CaseFormModular = dynamic(
  () => import('@/components/cases/case-form-modular').then(mod => ({ default: mod.CaseFormModular })),
  {
    loading: () => createElement('div', { className: 'animate-pulse' }, 'Loading form...'),
    ssr: false
  }
)

export const UserForm = dynamic(
  () => import('@/components/users/user-form').then(mod => ({ default: mod.UserForm })),
  {
    loading: () => createElement('div', { className: 'animate-pulse' }, 'Loading user form...'),
    ssr: false
  }
)

export const RiskAssessment = dynamic(
  () => import('@/components/validation/risk-assessment').then(mod => ({ default: mod.RiskAssessment })),
  {
    loading: () => createElement('div', { className: 'animate-pulse' }, 'Loading risk assessment...'),
    ssr: false
  }
)

export const ObservationSystem = dynamic(
  () => import('@/components/validation/observation-system').then(mod => ({ default: mod.ObservationSystem })),
  {
    loading: () => createElement('div', { className: 'animate-pulse' }, 'Loading observation system...'),
    ssr: false
  }
)

export const DashboardCharts = dynamic(
  () => import('@/components/dashboard/dashboard-charts').then(mod => ({ default: mod.DashboardCharts })),
  {
    loading: () => createElement('div', { className: 'animate-pulse' }, 'Loading charts...'),
    ssr: false
  }
)

export const DocumentUpload = dynamic(
  () => import('@/components/documents/DocumentUpload').then(mod => ({ default: mod.DocumentUpload })),
  {
    loading: () => createElement('div', { className: 'animate-pulse' }, 'Loading document upload...'),
    ssr: false
  }
)

// Chart components from recharts
export const BarChart = dynamic(
  () => import('recharts').then(mod => ({ default: mod.BarChart })),
  {
    loading: () => createElement('div', { className: 'h-[300px] bg-gray-100 animate-pulse rounded-lg' }),
    ssr: false
  }
)

export const LineChart = dynamic(
  () => import('recharts').then(mod => ({ default: mod.LineChart })),
  {
    loading: () => createElement('div', { className: 'h-[300px] bg-gray-100 animate-pulse rounded-lg' }),
    ssr: false
  }
)

export const PieChart = dynamic(
  () => import('recharts').then(mod => ({ default: mod.PieChart })),
  {
    loading: () => createElement('div', { className: 'h-[300px] bg-gray-100 animate-pulse rounded-lg' }),
    ssr: false
  }
)

// Export utility function for creating dynamic imports
export function createLazyImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback: () => ReactNode,
  ssr = false
) {
  return dynamic(importFn, {
    loading: fallback,
    ssr
  })
}