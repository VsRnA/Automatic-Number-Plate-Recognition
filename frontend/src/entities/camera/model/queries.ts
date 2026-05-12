import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cameraApi } from '../api/cameraApi'
import type { CreateCameraDto, UpdateCameraDto } from '../api/cameraApi'

export const cameraKeys = {
  all: ['cameras'] as const,
  list: () => [...cameraKeys.all, 'list'] as const,
  detail: (id: string) => [...cameraKeys.all, 'detail', id] as const,
  workerStatus: (id: string) => [...cameraKeys.detail(id), 'workerStatus'] as const,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: cameraKeys.all }),
  })
}

export function useCameraWorkerStatus(cameraId: string | undefined, workerEnabled: boolean) {
  return useQuery({
    queryKey: cameraKeys.workerStatus(cameraId ?? ''),
    queryFn: () => cameraApi.workerStatus(cameraId!),
    enabled: !!cameraId && workerEnabled,
    refetchInterval: 5000,
    staleTime: 4000,
  })
}

export function useCameraSnapshot(cameraId: string | undefined) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  useEffect(() => {
    if (!cameraId) return
    let objectUrl: string | null = null
    let cancelled = false

    setSnapshotUrl(null)
    setSnapshotLoading(true)

    cameraApi.snapshot(cameraId)
      .then(blob => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob)
          setSnapshotUrl(objectUrl)
        }
      })
      .catch(() => {
        if (!cancelled) setSnapshotUrl(null)
      })
      .finally(() => {
        if (!cancelled) setSnapshotLoading(false)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cameraId])

  return { snapshotUrl, snapshotLoading }
}
