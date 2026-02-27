import { api } from '@/shared/api'
import { API_BASE_URL } from '@/shared/config'
import type { Camera, StreamStatusResponse } from '../model/types'

export interface CameraListParams {
  name?: string
  isEnabled?: boolean
  accessPointId?: number
  limit?: number
  offset?: number
}

export interface CreateCameraDto {
  name: string
  stream: string
  streamHd: string
  login?: string | null
  password?: string | null
  accessPointId?: number | null
  isEnabled: boolean
  metadata?: Record<string, unknown>
}

export interface UpdateCameraDto {
  name?: string
  stream?: string
  streamHd?: string
  login?: string | null
  password?: string | null
  accessPointId?: number | null
  isEnabled?: boolean
  metadata?: Record<string, unknown>
}

export const cameraApi = {
  list: (params: CameraListParams = {}): Promise<Camera[]> => {
    const query = new URLSearchParams()
    if (params.name) query.set('name', params.name)
    if (params.isEnabled !== undefined) query.set('isEnabled', String(params.isEnabled))
    if (params.accessPointId !== undefined) query.set('accessPointId', String(params.accessPointId))
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    const qs = query.toString()
    return api.get<Camera[]>(`/cameras${qs ? `?${qs}` : ''}`)
  },

  get: (id: string): Promise<Camera> => api.get<Camera>(`/cameras/${id}`),

  create: (data: CreateCameraDto): Promise<Camera> => api.post<Camera>('/cameras', data),

  update: (id: string, data: UpdateCameraDto): Promise<Camera> =>
    api.put<Camera>(`/cameras/${id}`, data),

  delete: (id: string): Promise<void> => api.delete(`/cameras/${id}`),

  stream: {
    start: (id: string): Promise<{ message: string }> =>
      api.post(`/cameras/${id}/stream/start`, {}),

    stop: (id: string): Promise<{ message: string }> =>
      api.delete(`/cameras/${id}/stream/stop`) as unknown as Promise<{ message: string }>,

    status: (id: string): Promise<StreamStatusResponse> =>
      api.get<StreamStatusResponse>(`/cameras/${id}/stream/status`),

    hlsUrl: (id: string): string =>
      `${API_BASE_URL}/cameras/${id}/hls/index.m3u8`,
  },
}
