import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { plateApi } from '../api/plateApi'
import type { CreatePlateDto, UpdatePlateDto } from './types'

export const plateKeys = {
  all: ['plates'] as const,
  list: () => [...plateKeys.all, 'list'] as const,
}

export const usePlates = () =>
  useQuery({
    queryKey: plateKeys.list(),
    queryFn: () => plateApi.list({ limit: 200 }),
  })

export const useDeletePlate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => plateApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: plateKeys.all }),
  })
}

export const useCreatePlate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePlateDto) => plateApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: plateKeys.all }),
  })
}

export const useUpdatePlate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlateDto }) => plateApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: plateKeys.all }),
  })
}

export const usePreviewImport = () =>
  useMutation({ mutationFn: (file: File) => plateApi.previewImport(file) })

export const useImportPlates = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => plateApi.importCsv(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: plateKeys.all }),
  })
}
