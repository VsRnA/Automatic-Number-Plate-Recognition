import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accessPointApi } from '../api/accessPointApi'
import type { CreateAccessPointDto, UpdateAccessPointDto } from './types'

export const accessPointKeys = {
  all: ['access-points'] as const,
  list: () => [...accessPointKeys.all, 'list'] as const,
}

export const useAccessPoints = () =>
  useQuery({
    queryKey: accessPointKeys.list(),
    queryFn: () => accessPointApi.list({ limit: 200 }),
  })

export const useDeleteAccessPoint = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => accessPointApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: accessPointKeys.all }),
  })
}

export const useCreateAccessPoint = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAccessPointDto) => accessPointApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: accessPointKeys.all }),
  })
}

export const useUpdateAccessPoint = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAccessPointDto }) => accessPointApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: accessPointKeys.all }),
  })
}
