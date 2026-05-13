import { useState, useMemo } from 'react'
import { useRecognitionHistory } from '@/entities/recognitionHistory'
import { useAccessPoints } from '@/entities/accessPoint'
import { formatDateTime } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { TableSkeleton, Icon, PageHeader, PlateBadge, ConfidenceBar, Pagination } from '@/shared/ui'

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
        <img
          src={url}
          alt={plateNumber}
          style={{ width: 64, height: 40, objectFit: 'cover', display: 'block' }}
        />
      </a>
    )
  }
  return <AnprSnapshot />
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

export function HistoryPage() {
  const [search, setSearch] = useState('')
  const [accessPointFilter, setAccessPointFilter] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const { data: accessPoints = [] } = useAccessPoints()
  const accessPointMap = useMemo(() => new Map(accessPoints.map(ap => [ap.id, ap])), [accessPoints])

  const queryParams = {
    page,
    limit,
    ...(search.length === 0 || search.length >= 2 ? { plateNumber: search || undefined } : {}),
    ...(accessPointFilter !== undefined ? { accessPointId: accessPointFilter } : {}),
  }

  const { data, isLoading, error, refetch, isRefetching } = useRecognitionHistory(queryParams)

  const records = data?.data ?? []
  const total = data?.total ?? 0

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleAccessPointFilter(value: number | undefined) {
    setAccessPointFilter(value)
    setPage(1)
  }

  function handleLimitChange(value: number) {
    setLimit(value)
    setPage(1)
  }

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
                background: isRefetching ? 'var(--success)' : 'var(--fg-subtle)',
                display: 'inline-block',
                boxShadow: isRefetching ? '0 0 0 2px var(--success-soft)' : 'none',
                transition: 'all 0.3s',
              }} />
              Авто-обновление
            </span>
          </div>
        }
      />

      <div className="content">
        <div className="toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
            <input
              className="input"
              style={{ paddingLeft: 32 }}
              placeholder="Поиск по номеру…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <select
            className="select"
            style={{ minWidth: 180 }}
            value={accessPointFilter ?? ''}
            onChange={e => handleAccessPointFilter(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Все точки доступа</option>
            {accessPoints.map(ap => (
              <option key={ap.id} value={ap.id}>{ap.name}</option>
            ))}
          </select>
          <select
            className="select"
            value={limit}
            onChange={e => handleLimitChange(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n} на странице</option>
            ))}
          </select>
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
                        <span className="tag">Неизвестен</span>
                      ) : record.accessGranted === true ? (
                        <span className="tag tag-success">Разрешён</span>
                      ) : record.accessGranted === false ? (
                        <span className="tag tag-danger">Запрещён</span>
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
                          {search ? `Ничего не найдено по «${search}»` : 'История пуста'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--fg-subtle)', marginTop: 4 }}>
                          Записи появятся после первых распознаваний
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <Pagination
              page={page}
              total={total}
              limit={limit}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </>
  )
}
