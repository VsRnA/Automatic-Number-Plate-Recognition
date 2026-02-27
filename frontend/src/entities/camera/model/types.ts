export interface Camera {
  guid: string
  name: string
  stream: string
  streamHd: string
  login: string | null
  password: string | null
  accessPointId: number | null
  isEnabled: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type StreamStatus = 'idle' | 'running' | 'error' | 'loading'

export interface StreamStatusResponse {
  cameraId: string
  status: StreamStatus
  startedAt?: string
  error?: string
}

