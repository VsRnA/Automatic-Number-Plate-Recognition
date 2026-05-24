import { api } from '@/shared/api'
import type { DashboardData } from '../model/types'

export const analyticsApi = {
  getDashboard: (period?: string): Promise<DashboardData> =>
    api.get<DashboardData>(`/analytics/dashboard${period ? `?period=${period}` : ''}`),
}
