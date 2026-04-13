export interface Plate {
  guid: string
  number: string
  region: string
  accessType: string
  validUntil: string | null
  comment: string
  isEnabled: boolean
  createdAt: string
  accessPointIds: number[]
}

export interface CreatePlateDto {
  number: string
  region?: string
  accessType: string
  validUntil?: string | null
  comment?: string
  isEnabled?: boolean
  accessPointIds?: number[]
}

export interface UpdatePlateDto {
  number?: string
  region?: string
  accessType?: string
  validUntil?: string | null
  comment?: string
  isEnabled?: boolean
  accessPointIds?: number[]
}

export interface ImportRowErrors {
  number?: string
  region?: string
  accessType?: string
  validUntil?: string
}

export interface ImportPreviewRow {
  row: number
  number: string
  region: string
  accessType: string
  validUntil: string | null
  comment: string
  isEnabled: boolean
  errors: ImportRowErrors
  status: 'ok' | 'duplicate' | 'invalid'
}

export interface ImportPreviewResponse {
  rows: ImportPreviewRow[]
  totalOk: number
  totalDuplicates: number
  totalInvalid: number
}
