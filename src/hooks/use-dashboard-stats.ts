'use client'

import { useQuery } from '@tanstack/react-query'

interface DashboardStats {
  totalCases: number
  activeCases: number
  completedCases: number
  pendingCases: number
  inProgressCases: number
  overdueCases: number
  totalUsers: number
  activeUsers: number
  totalDepartments: number
  avgCompletionTime: number
  casesThisMonth: number
  casesLastMonth: number
  monthlyTrend: number
  monthlyTrendPercent: number
}

interface DashboardStatsResponse {
  success: boolean
  data: DashboardStats
  distributions?: {
    priority: { name: string; value: number }[]
    status: { name: string; value: number }[]
    stage: { name: string; value: number }[]
  }
  message?: string
}

export function useDashboardStats(departmentId?: string) {
  return useQuery<DashboardStatsResponse, Error>({
    queryKey: ['dashboard-stats', departmentId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (departmentId) {
        params.append('departmentId', departmentId)
      }

      const response = await fetch(`/api/dashboard/stats?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.statusText}`)
      }

      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - matches our refresh interval
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    retry: 2,
  })
}

export function useRecentCases(departmentId?: string, limit = 10) {
  return useQuery({
    queryKey: ['recent-cases', departmentId, limit],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (departmentId) params.append('departmentId', departmentId)
      params.append('limit', limit.toString())

      const response = await fetch(`/api/dashboard/recent-cases?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch recent cases: ${response.statusText}`)
      }
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useDepartmentActivity() {
  return useQuery({
    queryKey: ['department-activity'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/department-activity')
      if (!response.ok) {
        throw new Error(`Failed to fetch department activity: ${response.statusText}`)
      }
      return response.json()
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 8 * 60 * 1000, // 8 minutes
  })
}