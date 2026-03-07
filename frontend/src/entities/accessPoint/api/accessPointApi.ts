import { api } from '@/shared/api'
import type { AccessPoint, CreateAccessPointDto, UpdateAccessPointDto } from '../model/types'

export interface AccessPointListParams {
  name?: string
  isEnabled?: boolean
  limit?: number
  offset?: number
}

export const accessPointApi = {
  list: (params: AccessPointListParams = {}): Promise<AccessPoint[]> => {
    const query = new URLSearchParams()
    if (params.name) query.set('name', params.name)
    if (params.isEnabled !== undefined) query.set('isEnabled', String(params.isEnabled))
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    const qs = query.toString()
    return api.get<AccessPoint[]>(`/access-points${qs ? `?${qs}` : ''}`)
  },

  get: (id: number): Promise<AccessPoint> => api.get<AccessPoint>(`/access-points/${id}`),

  create: (data: CreateAccessPointDto): Promise<AccessPoint> =>
    api.post<AccessPoint>('/access-points', data),

  update: (id: number, data: UpdateAccessPointDto): Promise<AccessPoint> =>
    api.put<AccessPoint>(`/access-points/${id}`, data),

  delete: (id: number): Promise<void> => api.delete(`/access-points/${id}`),
}
