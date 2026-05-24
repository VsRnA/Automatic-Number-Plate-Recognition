import { api } from '@/shared/api'
import type { PaginatedHistoryResponse } from '../model/types'

export interface RecognitionHistoryListParams {
  cameraGuid?: string
  accessPointId?: number
  plateNumber?: string
  accessGranted?: boolean
  unknown?: boolean
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export const recognitionHistoryApi = {
  list: (params: RecognitionHistoryListParams = {}): Promise<PaginatedHistoryResponse> => {
    const query = new URLSearchParams()
    if (params.cameraGuid) query.set('cameraGuid', params.cameraGuid)
    if (params.accessPointId !== undefined) query.set('accessPointId', String(params.accessPointId))
    if (params.plateNumber) query.set('plateNumber', params.plateNumber)
    if (params.accessGranted !== undefined) query.set('accessGranted', String(params.accessGranted))
    if (params.unknown) query.set('unknown', 'true')
    if (params.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params.dateTo) query.set('dateTo', params.dateTo)
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    const qs = query.toString()
    return api.get<PaginatedHistoryResponse>(`/recognition/list${qs ? `?${qs}` : ''}`)
  },
}
