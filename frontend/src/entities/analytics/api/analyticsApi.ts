import { api } from '@/shared/api'
import type { DashboardData } from '../model/types'

export const analyticsApi = {
  getDashboard: (): Promise<DashboardData> => api.get<DashboardData>('/analytics/dashboard'),
}
