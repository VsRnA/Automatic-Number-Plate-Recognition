type StatusKind = 'active' | 'off' | 'error' | 'warning' | 'ok'

interface StatusDotProps {
  kind: StatusKind
  label?: string
}

const kindMap: Record<StatusKind, { cls: string; text: string }> = {
  active:  { cls: 'status-ok',   text: 'Активна' },
  ok:      { cls: 'status-ok',   text: 'Готова' },
  off:     { cls: 'status-off',  text: 'Отключена' },
  error:   { cls: 'status-err',  text: 'Ошибка' },
  warning: { cls: 'status-warn', text: 'Внимание' },
}

export function StatusDot({ kind, label }: StatusDotProps) {
  const { cls, text } = kindMap[kind] ?? kindMap.off
  return <span className={`status ${cls}`}>{label ?? text}</span>
}
