export interface AnalyticsSummary {
  total: number
  today: number
  thisWeek: number
  thisMonth: number
  uniquePlates: number
  granted: number
  denied: number
}

export interface TimelinePoint {
  day: string
  count: number
}

export interface CameraStats {
  cameraId: string
  cameraName: string
  count: number
}

export interface TopPlate {
  plateNumber: string
  count: number
  lastSeen: string
  grantedCount: number
}

export interface DashboardData {
  summary: AnalyticsSummary
  timeline: TimelinePoint[]
  byCamera: CameraStats[]
  topPlates: TopPlate[]
}
