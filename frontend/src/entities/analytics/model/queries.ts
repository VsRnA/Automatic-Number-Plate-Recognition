import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../api/analyticsApi'

export const analyticsKeys = {
  dashboard: (period?: string) => ['analytics', 'dashboard', period] as const,
}

export function useDashboard(period?: string) {
  return useQuery({
    queryKey: analyticsKeys.dashboard(period),
    queryFn: () => analyticsApi.getDashboard(period),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
