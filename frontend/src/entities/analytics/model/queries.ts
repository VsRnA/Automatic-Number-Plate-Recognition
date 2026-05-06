import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../api/analyticsApi'

export const analyticsKeys = {
  dashboard: ['analytics', 'dashboard'] as const,
}

export function useDashboard() {
  return useQuery({
    queryKey: analyticsKeys.dashboard,
    queryFn: analyticsApi.getDashboard,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
