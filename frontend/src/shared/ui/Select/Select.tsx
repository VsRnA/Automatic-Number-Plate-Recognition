import styles from './Select.module.css'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperStyle?: React.CSSProperties
}

export function Select({ wrapperStyle, children, ...props }: SelectProps) {
  return (
    <div className={styles.wrapper} style={wrapperStyle}>
      <select className={styles.select} {...props}>
        {children}
      </select>
      <span className={styles.chevron} aria-hidden>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </div>
  )
}
