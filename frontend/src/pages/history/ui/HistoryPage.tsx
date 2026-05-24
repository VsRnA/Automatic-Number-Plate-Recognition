import { useState, useMemo } from 'react'
import { useRecognitionHistory } from '@/entities/recognitionHistory'
import { useAccessPoints } from '@/entities/accessPoint'
import { formatDateTime } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { TableSkeleton, Icon, PageHeader, PlateBadge, ConfidenceBar, Pagination } from '@/shared/ui'

type ResultFilter = 'all' | 'allowed' | 'blocked' | 'unknown'

const PAGE_SIZE = 10

function resultFilterParams(filter: ResultFilter): { accessGranted?: boolean; unknown?: boolean } {
  if (filter === 'allowed') return { accessGranted: true }
  if (filter === 'blocked') return { accessGranted: false }
  if (filter === 'unknown') return { unknown: true }
  return {}
}

function AnprSnapshot() {
  return (
    <div style={{
      width: 64, height: 40, borderRadius: 5,
      background: 'linear-gradient(135deg, #1a2030 0%, #0d1117 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'grid', placeItems: 'center', flexShrink: 0, position: 'relative', overflow: 'hidden',
    }}>
      <svg width="64" height="40" viewBox="0 0 64 40" fill="none" style={{ position: 'absolute', inset: 0 }}>
        <rect x="0" y="28" width="64" height="12" fill="rgba(255,255,255,0.04)" />
        <rect x="28" y="30" width="8" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
        <rect x="28" y="34" width="8" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
        <rect x="18" y="22" width="28" height="8" rx="2" fill="rgba(255,255,255,0.1)" />
        <rect x="22" y="17" width="20" height="7" rx="2" fill="rgba(255,255,255,0.07)" />
        <circle cx="20" cy="28" r="2" fill="rgba(255,230,100,0.5)" />
        <circle cx="44" cy="28" r="2" fill="rgba(255,230,100,0.5)" />
        <rect x="26" y="25" width="12" height="4" rx="1" fill="rgba(120,170,255,0.35)" />
      </svg>
    </div>
  )
}

function SnapshotThumb({ url, plateNumber }: { url: string | null; plateNumber: string }) {
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
        <img src={url} alt={plateNumber} style={{ width: 64, height: 40, objectFit: 'cover', display: 'block' }} />
      </a>
    )
  }
  return <AnprSnapshot />
}

export function HistoryPage() {
  const [search, setSearch] = useState('')
  const [accessPointFilter, setAccessPointFilter] = useState<number | undefined>(undefined)
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [showApMenu, setShowApMenu] = useState(false)
  const [page, setPage] = useState(1)

  const { data: accessPoints = [] } = useAccessPoints()
  const accessPointMap = useMemo(() => new Map(accessPoints.map(ap => [ap.id, ap])), [accessPoints])

  const queryParams = {
    page,
    limit: PAGE_SIZE,
    ...(search.length === 0 || search.length >= 2 ? { plateNumber: search || undefined } : {}),
    ...(accessPointFilter !== undefined ? { accessPointId: accessPointFilter } : {}),
    ...resultFilterParams(resultFilter),
  }

  const { data, isLoading, error, refetch, isRefetching } = useRecognitionHistory(queryParams)

  const records = data?.data ?? []
  const total = data?.total ?? 0

  const selectedAp = accessPointFilter !== undefined
    ? accessPoints.find(ap => ap.id === accessPointFilter)
    : undefined

  const hasActiveFilters = !!search || accessPointFilter !== undefined || resultFilter !== 'all'

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleAccessPointFilter(value: number | undefined) {
    setAccessPointFilter(value)
    setShowApMenu(false)
    setPage(1)
  }

  function handleResultFilter(r: ResultFilter) {
    setResultFilter(r)
    setPage(1)
  }

  function resetFilters() {
    setSearch('')
    setAccessPointFilter(undefined)
    setResultFilter('all')
    setPage(1)
  }

  const resultTabs: { id: ResultFilter; label: string; color?: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'allowed', label: 'Разрешены', color: 'var(--success)' },
    { id: 'blocked', label: 'Заблокированы', color: 'var(--danger)' },
    { id: 'unknown', label: 'Не в базе', color: 'var(--warn)' },
  ]

  return (
    <>
      <PageHeader
        title="История распознаваний"
        crumbs="Основное"
        count={total}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-subtle)' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--success)',
                display: 'inline-block',
                boxShadow: '0 0 0 2px var(--success-soft)',
                animation: isRefetching ? 'pulseDot 1.4s infinite' : 'none',
                transition: 'all 0.3s',
              }} />
              Авто-обновление
            </span>
          </div>
        }
      />

      <div className="content">
        <div className="filter-bar">
          <div className="filter-bar-row">
            <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
              <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
              <input
                className="input"
                style={{ paddingLeft: 32 }}
                placeholder="Поиск по номеру…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>

            <div className="filter-pill-wrap">
              <button
                className={`filter-pill${accessPointFilter !== undefined ? ' filter-pill-active' : ''}`}
                onClick={() => setShowApMenu(v => !v)}
              >
                <Icon name="gate" size={13} />
                <span>{selectedAp ? selectedAp.name : 'Все точки'}</span>
                <Icon name="chevD" size={12} />
              </button>
              {showApMenu && (
                <>
                  <div className="filter-menu-backdrop" onClick={() => setShowApMenu(false)} />
                  <div className="filter-menu">
                    <button
                      className={`filter-menu-item${accessPointFilter === undefined ? ' active' : ''}`}
                      onClick={() => handleAccessPointFilter(undefined)}
                    >
                      {accessPointFilter === undefined && <Icon name="check" size={12} />}
                      {accessPointFilter !== undefined && <span style={{ width: 12 }} />}
                      Все точки доступа
                    </button>
                    {accessPoints.map(ap => (
                      <button
                        key={ap.id}
                        className={`filter-menu-item${accessPointFilter === ap.id ? ' active' : ''}`}
                        onClick={() => handleAccessPointFilter(ap.id)}
                      >
                        {accessPointFilter === ap.id && <Icon name="check" size={12} />}
                        {accessPointFilter !== ap.id && <span style={{ width: 12 }} />}
                        {ap.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {hasActiveFilters && (
              <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
                <Icon name="x" size={12} /> Сбросить
              </button>
            )}
          </div>

          <div className="filter-tabs">
            {resultTabs.map(t => (
              <button
                key={t.id}
                className={`filter-tab${resultFilter === t.id ? ' active' : ''}`}
                onClick={() => handleResultFilter(t.id)}
              >
                {t.color && <span className="filter-tab-dot" style={{ background: t.color }} />}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--danger)' }}>
            {getErrorMessage(error)}
            <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={() => refetch()}>Повторить</button>
          </div>
        )}

        {!error && (
          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Фото</th>
                  <th>Номер</th>
                  <th>Результат</th>
                  <th>Уверенность</th>
                  <th>Точка доступа</th>
                  <th>Камера</th>
                  <th>Время</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableSkeleton rows={6} cols={7} />}
                {!isLoading && records.map(record => (
                  <tr key={record.id}>
                    <td>
                      <SnapshotThumb url={record.snapshotUrl || null} plateNumber={record.plateNumber} />
                    </td>
                    <td>
                      <PlateBadge number={record.plateNumber} />
                    </td>
                    <td>
                      {record.plateGuid === null ? (
                        <span className="tag tag-warn">Не в базе</span>
                      ) : record.accessGranted === true ? (
                        <span className="tag tag-success">Разрешён</span>
                      ) : record.accessGranted === false ? (
                        <span className="tag tag-danger">Заблокирован</span>
                      ) : (
                        <span className="tag tag-accent">В базе</span>
                      )}
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <ConfidenceBar value={record.confidence} />
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>
                      {record.accessPointId !== null
                        ? accessPointMap.get(record.accessPointId)?.name ?? `#${record.accessPointId}`
                        : <span style={{ color: 'var(--fg-subtle)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>
                      {record.cameraGuid.slice(0, 8)}…
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(record.occurredAt)}
                    </td>
                  </tr>
                ))}
                {!isLoading && records.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty" style={{ padding: '32px 0' }}>
                        <Icon name="history" size={20} style={{ color: 'var(--fg-subtle)', marginBottom: 8 }} />
                        <div style={{ fontWeight: 500 }}>
                          {hasActiveFilters ? 'Ничего не найдено' : 'История пуста'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--fg-subtle)', marginTop: 4 }}>
                          {hasActiveFilters ? 'Попробуйте изменить фильтры или сбросить их' : 'Записи появятся после первых распознаваний'}
                        </div>
                        {hasActiveFilters && (
                          <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={resetFilters}>
                            Сбросить фильтры
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <Pagination
              page={page}
              total={total}
              limit={PAGE_SIZE}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </>
  )
}
