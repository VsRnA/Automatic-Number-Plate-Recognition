import styles from './Pagination.module.css'

interface PaginationProps {
  page: number
  total: number
  limit: number
  onChange: (page: number) => void
}

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

export function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const pages = buildPages(page, totalPages)

  return (
    <div className={styles.root}>
      <span className={styles.info}>{from}–{to} из {total.toLocaleString()}</span>

      <div className={styles.pages}>
        <button
          className={styles.btn}
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Предыдущая"
        >
          ‹
        </button>

        {pages.map((p, i) =>
          p === '...'
            ? <span key={`ellipsis-${i}`} className={styles.ellipsis}>…</span>
            : <button
                key={p}
                className={`${styles.btn} ${p === page ? styles.active : ''}`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
        )}

        <button
          className={styles.btn}
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Следующая"
        >
          ›
        </button>
      </div>
    </div>
  )
}
