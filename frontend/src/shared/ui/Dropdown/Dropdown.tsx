import { useState, useRef, useEffect } from 'react'
import styles from './Dropdown.module.css'

export interface DropdownOption {
  value: string | number
  label: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string | number | null | undefined
  onChange: (value: string | number | null) => void
  placeholder?: string
  disabled?: boolean
  wrapperStyle?: React.CSSProperties
}

export function Dropdown({ options, value, onChange, placeholder = 'Выбрать...', disabled, wrapperStyle }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const selected = options.find(o => String(o.value) === String(value ?? ''))

  return (
    <div ref={ref} className={styles.wrapper} style={wrapperStyle}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(p => !p)}
        disabled={disabled}
      >
        <span className={`${styles.triggerText} ${!selected ? styles.placeholder : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {open && (
        <div className={styles.list}>
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              className={`${styles.option} ${String(option.value) === String(value ?? '') ? styles.optionSelected : ''}`}
              onClick={() => {
                onChange(option.value === '' ? null : option.value)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
