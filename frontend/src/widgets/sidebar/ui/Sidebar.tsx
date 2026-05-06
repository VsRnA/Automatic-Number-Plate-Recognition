import { useNavigate, useLocation } from 'react-router-dom'
import { Icon } from '@/shared/ui'

interface SidebarProps {
  darkMode: boolean
  onToggleDark: () => void
}

const NAV_ITEMS = [
  { id: 'cameras',       label: 'Камеры',         icon: 'camera',    badge: null },
  { id: 'plates',        label: 'Номера',          icon: 'plate',     badge: null },
  { id: 'access-points', label: 'Точки доступа',   icon: 'gate',      badge: null },
  { id: 'history',       label: 'История',         icon: 'history',   badge: null },
  { id: 'analytics',     label: 'Аналитика',       icon: 'analytics', badge: null },
]

export function Sidebar({ darkMode, onToggleDark }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const active = location.pathname.split('/')[1] || 'cameras'

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
            {item.badge != null && <span className="badge">{item.badge}</span>}
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
