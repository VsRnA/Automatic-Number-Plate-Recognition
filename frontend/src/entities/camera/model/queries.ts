import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cameraApi } from '../api/cameraApi'
import type { CreateCameraDto, UpdateCameraDto } from '../api/cameraApi'

export const cameraKeys = {
  all: ['cameras'] as const,
  list: () => [...cameraKeys.all, 'list'] as const,
  detail: (id: string) => [...cameraKeys.all, 'detail', id] as const,
}

export const useCameras = () =>
  useQuery({
    queryKey: cameraKeys.list(),
    queryFn: () => cameraApi.list({ limit: 200 }),
  })

export const useCamera = (id: string) =>
  useQuery({
    queryKey: cameraKeys.detail(id),
    queryFn: () => cameraApi.get(id),
    enabled: !!id,
  })

export const useDeleteCamera = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cameraApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: cameraKeys.all }),
  })
}

export const useCreateCamera = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCameraDto) => cameraApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: cameraKeys.all }),
  })
}

export const useUpdateCamera = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCameraDto }) => cameraApi.update(id, data),
    onSuccess: (_data, { id }) => qc.invalidateQueries({ queryKey: cameraKeys.detail(id) }),
  })
}
