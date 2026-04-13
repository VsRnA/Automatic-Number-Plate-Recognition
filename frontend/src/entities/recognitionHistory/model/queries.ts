import { useQuery } from '@tanstack/react-query'
import { recognitionHistoryApi } from '../api/recognitionHistoryApi'

export const historyKeys = {
  all: ['history'] as const,
  list: (params?: object) => [...historyKeys.all, 'list', params] as const,
}

export const useRecognitionHistory = (params: { limit?: number; plateNumber?: string; accessPointId?: number } = {}) =>
  useQuery({
    queryKey: historyKeys.list(params),
    queryFn: () => recognitionHistoryApi.list({ limit: 50, ...params }),
    refetchInterval: 15_000,
  })
