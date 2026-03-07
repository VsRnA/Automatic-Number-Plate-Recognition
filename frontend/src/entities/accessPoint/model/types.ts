export interface AccessPoint {
  id: number
  name: string
  description: string
  isEnabled: boolean
  createdAt: string
}

export interface CreateAccessPointDto {
  name: string
  description?: string
  isEnabled?: boolean
}

export interface UpdateAccessPointDto {
  name?: string
  description?: string
  isEnabled?: boolean
}
