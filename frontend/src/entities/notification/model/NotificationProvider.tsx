import { useState, useCallback, useMemo, type ReactNode } from 'react'
import { useRecognitionHistory } from '@/entities/recognitionHistory'
import { useCameras } from '@/entities/camera'
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

  const { data: blockedData } = useRecognitionHistory({
    accessGranted: false,
    limit: 100,
    page: 1,
  })
  const { data: unknownData } = useRecognitionHistory({
    unknown: true,
    limit: 100,
    page: 1,
  })
  const { data: cameras = [] } = useCameras()

  const notifications = useMemo<AppNotification[]>(() => {
    const result: AppNotification[] = []
    const seen = new Set<string>()

    for (const r of blockedData?.data ?? []) {
      const id = `hist-blocked-${r.id}`
      if (seen.has(id)) continue
      seen.add(id)
      result.push({
        id,
        level: 'danger',
        title: 'Попытка проезда заблокированного номера',
        body: `Номер ${r.plateNumber} пытался проехать${r.accessPointId ? ` на точке доступа #${r.accessPointId}` : ''}. Проезд не разрешён.`,
        time: new Date(r.occurredAt),
        read: readIds.has(id),
        sourceType: 'plate',
        sourceId: r.plateNumber,
        actions: [{ label: 'Перейти в историю', href: '/history' }],
      })
    }

    for (const r of unknownData?.data ?? []) {
      const id = `hist-unknown-${r.id}`
      if (seen.has(id)) continue
      seen.add(id)
      result.push({
        id,
        level: 'warn',
        title: 'Нераспознанный номер',
        body: `Номер ${r.plateNumber || '?'} не найден в базе${r.accessPointId ? ` (точка доступа #${r.accessPointId})` : ''}. Уверенность: ${Math.round((r.confidence ?? 0) * 100)}%.`,
        time: new Date(r.occurredAt),
        read: readIds.has(id),
        sourceType: 'plate',
        actions: [{ label: 'Перейти в историю', href: '/history' }],
      })
    }

    for (const cam of cameras) {
      if (!cam.isEnabled) continue
      const workerOff = (cam.metadata as Record<string, unknown>)?.status === 'error'
      if (workerOff) {
        const id = `cam-offline-${cam.guid}`
        result.push({
          id,
          level: 'danger',
          title: 'Камера потеряла сигнал',
          body: `Камера «${cam.name}» не отвечает. Распознавание приостановлено.`,
          time: new Date(cam.updatedAt ?? cam.createdAt),
          read: readIds.has(id),
          sourceType: 'camera',
          sourceId: cam.guid,
          actions: [{ label: 'Открыть камеру', href: `/cameras/${cam.guid}` }],
        })
      }
    }

    result.sort((a, b) => b.time.getTime() - a.time.getTime())
    return result
  }, [blockedData, unknownData, cameras, readIds])

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
