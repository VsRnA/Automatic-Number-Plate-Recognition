import { api } from '@/shared/api'
import type { ApiToken, CreateApiTokenDto, CreateApiTokenResponse } from '../model/types'

export const apiTokenApi = {
  list: (): Promise<ApiToken[]> => api.get<ApiToken[]>('/tokens'),

  create: (data: CreateApiTokenDto): Promise<CreateApiTokenResponse> =>
    api.post<CreateApiTokenResponse>('/tokens', data),

  delete: (id: string): Promise<void> => api.delete(`/tokens/${id}`),
}
