import styles from './Sidebar.module.css'


function CameraIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <rect x="1" y="2" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 5L17 3V11L12 9V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function PlateIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <rect x="1" y="1" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="4" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8L10.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="6.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 9.5L14 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 12L13 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function AccessPointIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  )
}

function TestIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5 1H11V6L14 13H2L5 6V1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5 1H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 9H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const NAV_MAIN = [
  { id: 'cameras', label: 'Камеры', icon: <CameraIcon /> },
  { id: 'plates', label: 'Номера', icon: <PlateIcon /> },
  { id: 'access-points', label: 'Точки доступа', icon: <AccessPointIcon /> },
  { id: 'history', label: 'История', icon: <HistoryIcon /> },
  { id: 'test-recognition', label: 'Тест', icon: <TestIcon /> },
]

const NAV_CONFIG = [
  { id: 'api', label: 'API токены', icon: <KeyIcon /> },
]

interface SidebarProps {
  activeItem?: string
  onNavigate?: (id: string) => void
}

export function Sidebar({ activeItem = 'cameras', onNavigate }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoTitle}>ANRP</div>
        <div className={styles.logoSubtitle}>СИСТЕМА ДОСТУПА</div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.section}>
          <div className={styles.sectionLabel}>ОСНОВНОЕ</div>
          {NAV_MAIN.map(item => (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeItem === item.id ? styles.navItemActive : ''}`}
              onClick={() => onNavigate?.(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>КОНФИГУРАЦИЯ</div>
          {NAV_CONFIG.map(item => (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeItem === item.id ? styles.navItemActive : ''}`}
              onClick={() => onNavigate?.(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </aside>
  )
}
