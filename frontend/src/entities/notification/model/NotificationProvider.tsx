import { useState, useCallback, useMemo, type ReactNode } from 'react'
import { useRecognitionHistory } from '@/entities/recognitionHistory'
import type { AppNotification } from './types'
import { NotificationContext } from './notificationContext'

const STORAGE_KEY = 'anpr:notif:read'

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds)

  const { data: allowedData } = useRecognitionHistory({
    known: true,
    accessGranted: true,
    limit: 100,
    page: 1,
  })
  const { data: deniedData } = useRecognitionHistory({
    known: true,
    accessGranted: false,
    limit: 100,
    page: 1,
  })

  const notifications = useMemo<AppNotification[]>(() => {
    const result: AppNotification[] = []
    const seen = new Set<string>()

    for (const r of allowedData?.data ?? []) {
      const id = `hist-allowed-${r.id}`
      if (seen.has(id)) continue
      seen.add(id)
      result.push({
        id,
        level: 'success',
        title: 'Проезд разрешён',
        body: `Номер ${r.plateNumber} проехал${r.accessPointId ? ` на точке доступа #${r.accessPointId}` : ''}. Доступ разрешён.`,
        time: new Date(r.occurredAt),
        read: readIds.has(id),
        sourceType: 'plate',
        sourceId: r.plateNumber,
        actions: [{ label: 'Перейти в историю', href: '/history' }],
      })
    }

    for (const r of deniedData?.data ?? []) {
      const id = `hist-denied-${r.id}`
      if (seen.has(id)) continue
      seen.add(id)
      result.push({
        id,
        level: 'danger',
        title: 'Проезд запрещён',
        body: `Номер ${r.plateNumber} пытался проехать${r.accessPointId ? ` на точке доступа #${r.accessPointId}` : ''}. Доступ не разрешён.`,
        time: new Date(r.occurredAt),
        read: readIds.has(id),
        sourceType: 'plate',
        sourceId: r.plateNumber,
        actions: [{ label: 'Перейти в историю', href: '/history' }],
      })
    }

    result.sort((a, b) => b.time.getTime() - a.time.getTime())
    return result
  }, [allowedData, deniedData, readIds])

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  )

  const markRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev)
      next.add(id)
      saveReadIds(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev)
      notifications.forEach(n => next.add(n.id))
      saveReadIds(next)
      return next
    })
  }, [notifications])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  )
}
