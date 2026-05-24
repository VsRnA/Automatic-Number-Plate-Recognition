import { createContext } from 'react'
import type { AppNotification } from './types'

export interface NotificationContextValue {
  notifications: AppNotification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}

export const NotificationContext = createContext<NotificationContextValue | null>(null)
