import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/entities/notification'
import type { AppNotification, NotificationLevel } from '@/entities/notification'
import { Icon, PageHeader } from '@/shared/ui'

type FilterId = 'all' | 'unread' | 'success' | 'danger'

const FILTER_TABS: { id: FilterId; label: string; color?: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'unread', label: 'Непрочитанные' },
  { id: 'success', label: 'Разрешено', color: 'var(--success)' },
  { id: 'danger', label: 'Отказано', color: 'var(--danger)' },
]

function getIconStyle(level: NotificationLevel): { bg: string; fg: string } {
  switch (level) {
    case 'danger': return { bg: 'var(--danger-soft)', fg: 'var(--danger)' }
    case 'warn': return { bg: 'var(--warn-soft)', fg: 'var(--warn)' }
    case 'success': return { bg: 'var(--success-soft)', fg: 'var(--success)' }
    default: return { bg: 'var(--accent-soft)', fg: 'var(--accent)' }
  }
}

function getIconName(level: NotificationLevel): string {
  switch (level) {
    case 'danger': return 'info'
    case 'warn': return 'info'
    case 'success': return 'check'
    default: return 'info'
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function getDayLabel(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (d.getTime() === today.getTime()) return 'Сегодня'
  if (d.getTime() === yesterday.getTime()) return 'Вчера'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

interface NotificationRowProps {
  notification: AppNotification
  isLast: boolean
  onMarkRead: (id: string) => void
}

function NotificationRow({ notification: n, isLast, onMarkRead }: NotificationRowProps) {
  const navigate = useNavigate()
  const iconStyle = getIconStyle(n.level)

  function handleAction(href: string, e: React.MouseEvent) {
    e.stopPropagation()
    navigate(href)
  }

  return (
    <div
      className={`notif-row${!n.read ? ' notif-unread' : ''}${!isLast ? ' notif-border' : ''}`}
      onClick={() => onMarkRead(n.id)}
    >
      <div className="notif-icon" style={{ background: iconStyle.bg, color: iconStyle.fg }}>
        <Icon name={getIconName(n.level)} size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="notif-head">
          <div className="notif-title">{n.title}</div>
          {!n.read && <span className="notif-dot" />}
          <span className="notif-time">{formatTime(n.time)}</span>
        </div>
        <div className="notif-body">{n.body}</div>
        {n.actions && n.actions.length > 0 && (
          <div className="notif-actions">
            {n.actions.map((a, i) => (
              <button
                key={i}
                className="btn btn-sm btn-ghost"
                onClick={e => handleAction(a.href, e)}
              >
                {a.label} <Icon name="chevR" size={11} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [filter, setFilter] = useState<FilterId>('all')

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true
    if (filter === 'unread') return !n.read
    return n.level === filter
  })

  const counts: Record<FilterId, number> = {
    all: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    success: notifications.filter(n => n.level === 'success').length,
    danger: notifications.filter(n => n.level === 'danger').length,
  }

  const groups: Record<string, AppNotification[]> = {}
  for (const n of filtered) {
    const label = getDayLabel(n.time)
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }

  return (
    <>
      <PageHeader
        title="Уведомления"
        crumbs="Основное"
        count={unreadCount || undefined}
        actions={
          <button
            className="btn"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <Icon name="check" /> Прочитать все
          </button>
        }
      />

      <div className="content">
        <div className="filter-bar">
          <div className="filter-tabs">
            {FILTER_TABS.map(t => (
              <button
                key={t.id}
                className={`filter-tab${filter === t.id ? ' active' : ''}`}
                onClick={() => setFilter(t.id)}
              >
                {t.color && <span className="filter-tab-dot" style={{ background: t.color }} />}
                <span>{t.label}</span>
                <span
                  className="filter-tab-count"
                  style={t.id === 'unread' && counts.unread > 0
                    ? { background: 'var(--danger)', color: 'white' }
                    : undefined}
                >
                  {counts[t.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: '40px 0' }}>
              <Icon name="check" size={24} style={{ color: 'var(--fg-subtle)', marginBottom: 10 }} />
              <div style={{ fontWeight: 500 }}>Уведомлений нет</div>
              <div style={{ fontSize: 13, color: 'var(--fg-subtle)', marginTop: 4 }}>
                {filter === 'all'
                  ? 'Здесь появляются уведомления о разрешённых и запрещённых проездах'
                  : 'В этой категории уведомлений нет'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(groups).map(([day, group]) => (
              <div key={day}>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--fg-subtle)',
                  padding: '0 4px 8px',
                }}>
                  {day}
                </div>
                <div className="card" style={{ overflow: 'hidden' }}>
                  {group.map((n, i) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      isLast={i === group.length - 1}
                      onMarkRead={markRead}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
