import { useNavigate, useLocation } from 'react-router-dom'
import { Icon } from '@/shared/ui'
import { useNotifications } from '@/entities/notification'

interface SidebarProps {
  darkMode: boolean
  onToggleDark: () => void
}

const NAV_ITEMS = [
  { id: 'cameras',       label: 'Камеры',          icon: 'camera',    },
  { id: 'plates',        label: 'Номера',           icon: 'plate',     },
  { id: 'access-points', label: 'Точки доступа',    icon: 'gate',      },
  { id: 'history',       label: 'История',          icon: 'history',   },
  { id: 'analytics',     label: 'Аналитика',        icon: 'analytics', },
  { id: 'notifications', label: 'Уведомления',      icon: 'bell',      },
]

export function Sidebar({ darkMode, onToggleDark }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const active = location.pathname.split('/')[1] || 'cameras'
  const { unreadCount } = useNotifications()

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <div className="brand-name">ANPR</div>
          <div className="brand-sub">Система доступа</div>
        </div>
      </div>

      {/* Nav */}
      <div className="nav-group">
        <div className="nav-label">Основное</div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => navigate(`/${item.id}`)}
          >
            <Icon name={item.icon} size={16} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.id === 'notifications' && unreadCount > 0 && (
              <span className="badge" style={{ background: 'var(--danger)', color: 'white', minWidth: 18, textAlign: 'center' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          className="nav-item"
          onClick={onToggleDark}
          title={darkMode ? 'Светлая тема' : 'Тёмная тема'}
        >
          <Icon name={darkMode ? 'sun' : 'moon'} size={16} />
          <span style={{ flex: 1 }}>{darkMode ? 'Светлая тема' : 'Тёмная тема'}</span>
        </button>
        <div className="user-chip">
          <div className="avatar">ИК</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>Инженер</div>
            <div style={{ fontSize: 11, color: 'var(--fg-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ANPR System</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
