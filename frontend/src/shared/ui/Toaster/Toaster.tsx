import { useToast } from '@/shared/lib/toast'
import styles from './Toaster.module.css'

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
    </svg>
  )
}

export function Toaster() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
          <span className={styles.icon}>
            <ErrorIcon />
          </span>
          <span className={styles.message}>{toast.message}</span>
          <button className={styles.close} onClick={() => removeToast(toast.id)}>
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  )
}
