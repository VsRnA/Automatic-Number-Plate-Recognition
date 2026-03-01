import { useState, useEffect } from 'react'
import type { RecognitionHistory } from '@/entities/recognitionHistory'
import { recognitionHistoryApi } from '@/entities/recognitionHistory'
import { formatDateTime } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import styles from './HistoryPage.module.css'

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function HistoryPage() {
  const [records, setRecords] = useState<RecognitionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = (plateNumber?: string) => {
    setLoading(true)
    setError(null)
    recognitionHistoryApi.list({ limit: 50, plateNumber: plateNumber || undefined })
      .then(data => setRecords(data))
      .catch((err: unknown) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    recognitionHistoryApi.list({ limit: 50 })
      .then(data => { if (!cancelled) setRecords(data) })
      .catch((err: unknown) => { if (!cancelled) setError(getErrorMessage(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    if (value.length === 0 || value.length >= 2) {
      load(value)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbRoot}>Система</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>История распознаваний</span>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.statsRow}>
          <div className={styles.statChip}>
            <span className={styles.statChipLabel}>ПОКАЗАНО</span>
            <span className={styles.statChipCount}>{records.length}</span>
          </div>
          <div className={styles.statChip}>
            <span className={`${styles.statChipLabel} ${styles.labelGreen}`}>ИЗВЕСТНЫЕ</span>
            <span className={`${styles.statChipCount} ${styles.countGreen}`}>{records.filter(r => r.plateGuid !== null).length}</span>
          </div>
          <div className={styles.statChip}>
            <span className={`${styles.statChipLabel} ${styles.labelGray}`}>НЕИЗВЕСТНЫЕ</span>
            <span className={`${styles.statChipCount} ${styles.countGray}`}>{records.filter(r => r.plateGuid === null).length}</span>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}><SearchIcon /></span>
            <input className={styles.searchInput} type="text" placeholder="Поиск по номеру..."
              value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          <button className={styles.refreshBtn} onClick={() => load(search)}>Обновить</button>
        </div>

        <div className={styles.tableWrapper}>
          {loading && <div className={styles.stateMessage}>Загрузка...</div>}
          {error && (
            <div className={styles.stateError}>
              {error}
              <button className={styles.retryBtn} onClick={() => load(search)}>Повторить</button>
            </div>
          )}
          {!loading && !error && (
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadRow}>
                  <th className={styles.th}>ВРЕМЯ</th>
                  <th className={styles.th}>НОМЕР</th>
                  <th className={styles.th}>СОВПАДЕНИЕ</th>
                  <th className={styles.th}>УВЕРЕННОСТЬ</th>
                  <th className={styles.th}>ТОЧКА ДОСТУПА</th>
                  <th className={styles.th}>КАМЕРА</th>
                  <th className={styles.th}>ФОТО</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => (
                  <tr key={record.id} className={styles.row}>
                    <td className={styles.cell}>
                      <span className={styles.datetime}>{formatDateTime(record.occurredAt)}</span>
                    </td>
                    <td className={styles.cell}>
                      <span className={styles.plateNumber}>{record.plateNumber}</span>
                    </td>
                    <td className={styles.cell}>
                      {record.plateGuid !== null ? (
                        <span className={styles.matchBadge}>В базе</span>
                      ) : (
                        <span className={styles.unknownBadge}>Неизвестен</span>
                      )}
                    </td>
                    <td className={styles.cell}>
                      <ConfidenceBar value={record.confidence} />
                    </td>
                    <td className={styles.cell}>
                      {record.accessPointId !== null ? (
                        <span className={styles.apBadge}>#{record.accessPointId}</span>
                      ) : (
                        <span className={styles.dash}>—</span>
                      )}
                    </td>
                    <td className={styles.cell}>
                      <span className={styles.cameraId} title={record.cameraGuid}>
                        {record.cameraGuid.slice(0, 8)}…
                      </span>
                    </td>
                    <td className={styles.cell}>
                      {record.snapshotUrl ? (
                        <a href={record.snapshotUrl} target="_blank" rel="noreferrer" className={styles.photoThumbLink}>
                          <img
                            src={record.snapshotUrl}
                            alt={record.plateNumber}
                            className={styles.photoThumb}
                          />
                        </a>
                      ) : (
                        <span className={styles.dash}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={7} className={styles.stateMessage}>Записей не найдено</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626'
  return (
    <div className={styles.confidenceRow}>
      <div className={styles.confidenceBar}>
        <div className={styles.confidenceFill} style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className={styles.confidenceLabel} style={{ color }}>{pct}%</span>
    </div>
  )
}
