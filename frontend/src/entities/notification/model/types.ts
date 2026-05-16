export type NotificationLevel = 'danger' | 'warn' | 'info' | 'success'

export interface NotificationAction {
  label: string
  href: string
}

export interface AppNotification {
  id: string
  level: NotificationLevel
  title: string
  body: string
  time: Date
  read: boolean
  sourceType?: 'camera' | 'plate' | 'system'
  sourceId?: string | number
  actions?: NotificationAction[]
}
