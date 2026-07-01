export interface AccessPoint {
  id: number
  name: string
  description: string
  httpRequestUrl?: string | null
  isEnabled: boolean
  createdAt: string
}

export interface CreateAccessPointDto {
  name: string
  description?: string
  httpRequestUrl?: string | null
  isEnabled?: boolean
}

export interface UpdateAccessPointDto {
  name?: string
  description?: string
  httpRequestUrl?: string | null
  isEnabled?: boolean
}
