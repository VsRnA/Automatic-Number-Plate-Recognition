import { useQuery } from '@tanstack/react-query'
import { recognitionHistoryApi } from '../api/recognitionHistoryApi'

export const historyKeys = {
  all: ['history'] as const,
  list: (params?: object) => [...historyKeys.all, 'list', params] as const,
}

export interface UseRecognitionHistoryParams {
  page?: number
  limit?: number
  plateNumber?: string
  accessPointId?: number
  accessGranted?: boolean
  unknown?: boolean
  known?: boolean
  dateFrom?: string
  dateTo?: string
}

export const useRecognitionHistory = (params: UseRecognitionHistoryParams = {}) => {
  const limit = params.limit ?? 20
  const page = params.page ?? 1
  const offset = (page - 1) * limit

  return useQuery({
    queryKey: historyKeys.list({ ...params, limit, offset }),
    queryFn: () => recognitionHistoryApi.list({
      limit,
      offset,
      plateNumber: params.plateNumber,
      accessPointId: params.accessPointId,
      accessGranted: params.accessGranted,
      unknown: params.unknown,
      known: params.known,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    }),
    refetchInterval: page === 1 ? 15_000 : false,
  })
}
