import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiTokenApi } from '../api/apiTokenApi'
import type { CreateApiTokenDto } from './types'

export const apiTokenKeys = {
  all: ['api-tokens'] as const,
  list: () => [...apiTokenKeys.all, 'list'] as const,
}

export const useApiTokens = () =>
  useQuery({
    queryKey: apiTokenKeys.list(),
    queryFn: () => apiTokenApi.list(),
  })

export const useDeleteApiToken = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiTokenApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: apiTokenKeys.all }),
  })
}

export const useCreateApiToken = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateApiTokenDto) => apiTokenApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: apiTokenKeys.all }),
  })
}
