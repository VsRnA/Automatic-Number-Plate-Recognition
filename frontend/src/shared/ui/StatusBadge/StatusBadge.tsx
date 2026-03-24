import styles from './StatusBadge.module.css'

interface StatusBadgeProps {
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
  onClick?: () => void
}

export function StatusBadge({
  active,
  activeLabel = 'АКТИВЕН',
  inactiveLabel = 'ОТКЛЮЧЁН',
  onClick,
}: StatusBadgeProps) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      className={`${styles.badge} ${active ? styles.active : styles.inactive} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className={styles.dot} />
      {active ? activeLabel : inactiveLabel}
    </Tag>
  )
}
