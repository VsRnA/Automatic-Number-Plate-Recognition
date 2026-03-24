import { api } from '@/shared/api'
import type { Plate, CreatePlateDto, UpdatePlateDto, ImportPreviewResponse } from '../model/types'

export interface PlateListParams {
  number?: string
  isEnabled?: boolean
  limit?: number
  offset?: number
}

export const plateApi = {
  list: (params: PlateListParams = {}): Promise<Plate[]> => {
    const query = new URLSearchParams()
    if (params.number) query.set('number', params.number)
    if (params.isEnabled !== undefined) query.set('isEnabled', String(params.isEnabled))
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    const qs = query.toString()
    return api.get<Plate[]>(`/plates${qs ? `?${qs}` : ''}`)
  },

  get: (id: string): Promise<Plate> => api.get<Plate>(`/plates/${id}`),

  create: (data: CreatePlateDto): Promise<Plate> => api.post<Plate>('/plates', data),

  update: (id: string, data: UpdatePlateDto): Promise<Plate> =>
    api.put<Plate>(`/plates/${id}`, data),

  delete: (id: string): Promise<void> => api.delete(`/plates/${id}`),

  previewImport: (file: File): Promise<ImportPreviewResponse> => {
    const form = new FormData()
    form.append('file', file)
    return api.postForm<ImportPreviewResponse>('/plates/import/preview', form)
  },

  importCsv: (file: File): Promise<{ created: number; skipped: number }> => {
    const form = new FormData()
    form.append('file', file)
    return api.postForm('/plates/import', form)
  },
}
