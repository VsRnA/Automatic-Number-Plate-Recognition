export interface ScudIntegrationResult {
  request: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: string
  }
  response: {
    statusCode: number
    headers?: Record<string, string>
    body: string
    durationMs: number
    error?: string
  }
}

export interface RecognitionHistory {
  id: string
  cameraGuid: string
  accessPointId: number | null
  plateNumber: string
  plateGuid: string | null
  confidence: number
  accessGranted: boolean | null
  scudResult?: ScudIntegrationResult | null
  snapshotUrl: string
  occurredAt: string
  createdAt: string
}

export interface PaginatedHistoryResponse {
  data: RecognitionHistory[]
  total: number
  limit: number
  offset: number
}
