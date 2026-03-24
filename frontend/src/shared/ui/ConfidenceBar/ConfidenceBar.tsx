import styles from './ConfidenceBar.module.css'

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-warning)' : 'var(--color-error)'
  return (
    <div className={styles.row}>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className={styles.label} style={{ color }}>{pct}%</span>
    </div>
  )
}
