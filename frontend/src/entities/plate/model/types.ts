export interface Plate {
  guid: string
  number: string
  region: string
  accessType: string
  validUntil: string | null
  comment: string
  isEnabled: boolean
  createdAt: string
}

export interface CreatePlateDto {
  number: string
  region?: string
  accessType: string
  validUntil?: string | null
  comment?: string
  isEnabled?: boolean
}

export interface UpdatePlateDto {
  number?: string
  region?: string
  accessType?: string
  validUntil?: string | null
  comment?: string
  isEnabled?: boolean
}
