import styles from './StatPill.module.css'

interface StatPillProps {
  label: string
  count: number
  variant?: 'default' | 'green' | 'red' | 'gray'
}

export function StatPill({ label, count, variant = 'default' }: StatPillProps) {
  return (
    <div className={`${styles.pill} ${styles[variant]}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.count}>{count}</span>
    </div>
  )
}
