export interface RecognitionHistory {
  id: string
  cameraGuid: string
  accessPointId: number | null
  plateNumber: string
  plateGuid: string | null
  confidence: number
  accessGranted: boolean | null
  snapshotUrl: string
  occurredAt: string
  createdAt: string
}
