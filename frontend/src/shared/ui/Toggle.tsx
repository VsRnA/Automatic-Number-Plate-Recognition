interface ToggleProps {
  on: boolean
  onChange: (val: boolean) => void
  'aria-label'?: string
}

export function Toggle({ on, onChange, 'aria-label': ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
    />
  )
}
