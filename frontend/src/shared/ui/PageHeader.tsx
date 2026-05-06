import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  crumbs?: string
  count?: number
  actions?: ReactNode
}

export function PageHeader({ title, crumbs, count, actions }: PageHeaderProps) {
  return (
    <div className="topbar">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1>
          {title}
          {typeof count === 'number' && (
            <span style={{ color: 'var(--fg-subtle)', fontWeight: 400, marginLeft: 8, fontSize: 16 }}>
              {count}
            </span>
          )}
        </h1>
      </div>
      {actions && <div className="topbar-actions">{actions}</div>}
    </div>
  )
}
