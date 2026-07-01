import { useState, useMemo } from 'react'
import { useRecognitionHistory, type RecognitionHistory, type ScudIntegrationResult } from '@/entities/recognitionHistory'
import { useAccessPoints } from '@/entities/accessPoint'
import { formatDateTime } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { TableSkeleton, Icon, PageHeader, PlateBadge, ConfidenceBar, Pagination } from '@/shared/ui'

const PAGE_SIZE = 10

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

function AccessResultTag() {
  return <span className="tag tag-success">Разрешён</span>
}

function ScudCell({ scudResult, onClick }: { scudResult?: ScudIntegrationResult | null; onClick?: () => void }) {
  if (!scudResult?.request?.url) {
    return <span style={{ color: 'var(--fg-subtle)' }}>—</span>
  }
  const { method, url, body: reqBody } = scudResult.request
  const { statusCode, error } = scudResult.response ?? {}

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={e => { e.stopPropagation(); onClick?.() }}
      style={{ padding: '4px 6px', maxWidth: 220, textAlign: 'left', height: 'auto' }}
      title="Подробности запроса"
    >
      <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {method} {url}
      </div>
      {reqBody && (
        <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {reqBody}
        </div>
      )}
      {statusCode !== undefined && statusCode > 0 && (
        <span className={`tag ${statusCode >= 200 && statusCode < 300 ? 'tag-success' : 'tag-danger'}`} style={{ marginTop: 4 }}>
          {statusCode}
        </span>
      )}
      {error && <span className="tag tag-danger" style={{ marginTop: 4 }}>ошибка</span>}
    </button>
  )
}

function formatJsonBlock(raw: string): string {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

interface ScudDetailModalProps {
  record: RecognitionHistory
  accessPointName?: string
  configuredUrl?: string | null
  onClose: () => void
}

function ScudDetailModal({ record, accessPointName, configuredUrl, onClose }: ScudDetailModalProps) {
  const scud = record.scudResult
  const req = scud?.request
  const resp = scud?.response
  const sentUrl = req?.url ?? ''
  const urlMatchesConfig = configuredUrl && sentUrl === configuredUrl.trim().replace(/\/$/, '')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>CommonHttpRequest</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13 }}>
              <div><span className="text-subtle">Номер:</span> <PlateBadge number={record.plateNumber} /></div>
              <div><span className="text-subtle">Время:</span> {formatDateTime(record.occurredAt)}</div>
              {accessPointName && (
                <div><span className="text-subtle">Точка:</span> {accessPointName}</div>
              )}
            </div>

            {!scud?.request?.url ? (
              <div className="empty" style={{ padding: '24px 0' }}>
                <div style={{ fontWeight: 500 }}>Запрос не отправлялся</div>
                <div className="text-subtle text-sm" style={{ marginTop: 4 }}>
                  CommonHttpRequest выполняется только для разрешённых проездов номеров из базы.
                </div>
              </div>
            ) : (
              <>
                <div style={{ padding: 14, background: 'var(--bg-sunken)', borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div className="text-subtle text-xs" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Целевой URL запроса
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>
                    {sentUrl}
                  </div>
                  {configuredUrl && (
                    <div style={{ marginTop: 10, fontSize: 12.5, color: urlMatchesConfig ? 'var(--success)' : 'var(--fg-muted)' }}>
                      {urlMatchesConfig
                        ? '✓ Совпадает с адресом, указанным на точке доступа'
                        : `Адрес на точке доступа: ${configuredUrl}`}
                    </div>
                  )}
                  {!configuredUrl && (
                    <div className="text-subtle text-xs" style={{ marginTop: 8 }}>
                      Использован глобальный SCUD_URL (адрес на точке доступа не задан)
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Запрос</div>
                  <div className="text-subtle text-xs" style={{ marginBottom: 4 }}>Метод: {req?.method ?? 'POST'}</div>
                  <pre style={{
                    margin: 0, padding: 12, background: 'var(--bg)', border: '1px solid var(--line)',
                    borderRadius: 6, fontSize: 11.5, overflow: 'auto', maxHeight: 160,
                  }}>
                    {formatJsonBlock(req?.body ?? '')}
                  </pre>
                </div>

                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Ответ заглушки</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    {resp?.statusCode !== undefined && resp.statusCode > 0 && (
                      <span className={`tag ${resp.statusCode >= 200 && resp.statusCode < 300 ? 'tag-success' : 'tag-danger'}`}>
                        HTTP {resp.statusCode}
                      </span>
                    )}
                    {resp?.durationMs !== undefined && (
                      <span className="tag">{resp.durationMs} ms</span>
                    )}
                    {resp?.error && <span className="tag tag-danger">{resp.error}</span>}
                  </div>
                  <pre style={{
                    margin: 0, padding: 12, background: 'var(--bg)', border: '1px solid var(--line)',
                    borderRadius: 6, fontSize: 11.5, overflow: 'auto', maxHeight: 160,
                  }}>
                    {formatJsonBlock(resp?.body ?? '')}
                  </pre>
                  <div className="text-subtle text-xs" style={{ marginTop: 8 }}>
                    Запрос проксируется через заглушку сервера: POST /internal/common-http-request
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <span />
          <button className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

function HistoryTable({
  records,
  isLoading,
  accessPointMap,
  hasActiveFilters,
  onResetFilters,
  onRecordClick,
}: {
  records: RecognitionHistory[]
  isLoading: boolean
  accessPointMap: Map<number, { name: string; httpRequestUrl?: string | null }>
  hasActiveFilters: boolean
  onResetFilters: () => void
  onRecordClick: (record: RecognitionHistory) => void
}) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th style={{ width: 80 }}>Фото</th>
          <th>Номер</th>
          <th>Результат</th>
          <th style={{ minWidth: 220 }}>Запрос в СКУД</th>
          <th>Уверенность</th>
          <th>Точка доступа</th>
          <th>Камера</th>
          <th>Время</th>
        </tr>
      </thead>
      <tbody>
        {isLoading && <TableSkeleton rows={6} cols={8} />}
        {!isLoading && records.map(record => (
          <tr
            key={record.id}
            onClick={() => onRecordClick(record)}
            style={{ cursor: 'pointer' }}
          >
            <td>
              <SnapshotThumb url={record.snapshotUrl || null} plateNumber={record.plateNumber} />
            </td>
            <td>
              <PlateBadge number={record.plateNumber} />
            </td>
            <td>
              <AccessResultTag />
            </td>
            <td onClick={e => e.stopPropagation()}>
              <ScudCell scudResult={record.scudResult} onClick={() => onRecordClick(record)} />
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
            <td colSpan={8}>
              <div className="empty" style={{ padding: '32px 0' }}>
                <Icon name="history" size={20} style={{ color: 'var(--fg-subtle)', marginBottom: 8 }} />
                <div style={{ fontWeight: 500 }}>
                  {hasActiveFilters ? 'Ничего не найдено' : 'История пуста'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-subtle)', marginTop: 4 }}>
                  {hasActiveFilters
                    ? 'Попробуйте изменить фильтры или сбросить их'
                    : 'Записи появятся после разрешённых проездов номеров из базы'}
                </div>
                {hasActiveFilters && (
                  <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={onResetFilters}>
                    Сбросить фильтры
                  </button>
                )}
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export function HistoryPage() {
  const [search, setSearch] = useState('')
  const [accessPointFilter, setAccessPointFilter] = useState<number | undefined>(undefined)
  const [showApMenu, setShowApMenu] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<RecognitionHistory | null>(null)

  const { data: accessPoints = [] } = useAccessPoints()
  const accessPointMap = useMemo(
    () => new Map(accessPoints.map(ap => [ap.id, { name: ap.name, httpRequestUrl: ap.httpRequestUrl }])),
    [accessPoints],
  )

  const queryParams = {
    page,
    limit: PAGE_SIZE,
    known: true,
    accessGranted: true,
    ...(search.length === 0 || search.length >= 2 ? { plateNumber: search || undefined } : {}),
    ...(accessPointFilter !== undefined ? { accessPointId: accessPointFilter } : {}),
  }

  const { data, isLoading, error, refetch } = useRecognitionHistory(queryParams)

  const records = data?.data ?? []
  const total = data?.total ?? 0

  const selectedAp = accessPointFilter !== undefined
    ? accessPoints.find(ap => ap.id === accessPointFilter)
    : undefined

  const hasActiveFilters = !!search || accessPointFilter !== undefined

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleAccessPointFilter(value: number | undefined) {
    setAccessPointFilter(value)
    setShowApMenu(false)
    setPage(1)
  }

  function resetFilters() {
    setSearch('')
    setAccessPointFilter(undefined)
    setPage(1)
  }

  return (
    <>
      {selectedRecord && (
        <ScudDetailModal
          record={selectedRecord}
          accessPointName={
            selectedRecord.accessPointId !== null
              ? accessPointMap.get(selectedRecord.accessPointId)?.name
              : undefined
          }
          configuredUrl={
            selectedRecord.accessPointId !== null
              ? accessPointMap.get(selectedRecord.accessPointId)?.httpRequestUrl
              : undefined
          }
          onClose={() => setSelectedRecord(null)}
        />
      )}

      <PageHeader
        title="История распознаваний"
        crumbs="Основное"
        count={total}
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
        </div>

        {error && (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--danger)' }}>
            {getErrorMessage(error)}
            <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={() => refetch()}>Повторить</button>
          </div>
        )}

        {!error && (
          <div className="card">
            <HistoryTable
              records={records}
              isLoading={isLoading}
              accessPointMap={accessPointMap}
              hasActiveFilters={hasActiveFilters}
              onResetFilters={resetFilters}
              onRecordClick={setSelectedRecord}
            />

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
