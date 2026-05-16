interface PaginationProps {
  page: number
  total: number
  limit: number
  onChange: (page: number) => void
  onLimitChange?: (limit: number) => void
}

const LIMIT_OPTIONS = [10, 20, 50, 100]

function buildPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}

export function Pagination({ page, total, limit, onChange, onLimitChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit)
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const pages = buildPages(page, totalPages)

  if (totalPages <= 1 && !onLimitChange) return null

  return (
    <div className="pagination">
      <span className="pagination-info">
        <span style={{ fontFamily: 'var(--font-mono)' }}>{from}–{to}</span>
        {' '}
        <span style={{ color: 'var(--fg-subtle)' }}>из {total.toLocaleString('ru-RU')}</span>
      </span>

      <div className="pagination-controls">
        <button
          className="pag-btn"
          onClick={() => onChange(1)}
          disabled={page === 1}
          aria-label="Первая страница"
          title="Первая"
        >
          «
        </button>
        <button
          className="pag-btn"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Предыдущая"
        >
          ‹
        </button>

        <div className="pag-nums">
          {pages.map((p, i) =>
            p === '...'
              ? <span key={`ellipsis-${i}`} className="pag-ellipsis">…</span>
              : <button
                  key={p}
                  className={`pag-num${p === page ? ' active' : ''}`}
                  onClick={() => onChange(p)}
                >
                  {p}
                </button>
          )}
        </div>

        <button
          className="pag-btn"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Следующая"
        >
          ›
        </button>
        <button
          className="pag-btn"
          onClick={() => onChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Последняя страница"
          title="Последняя"
        >
          »
        </button>
      </div>

      {onLimitChange && (
        <div className="pagination-perpage">
          <span className="text-subtle text-xs">На странице</span>
          <select
            className="pag-select"
            value={limit}
            onChange={e => onLimitChange(Number(e.target.value))}
          >
            {LIMIT_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
