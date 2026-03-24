export interface ApiToken {
  id: string
  tokenPrefix: string
  description: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

export interface CreateApiTokenResponse extends ApiToken {
  token: string 
}

export interface CreateApiTokenDto {
  description?: string
}
