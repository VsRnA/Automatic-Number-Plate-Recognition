import { useState } from 'react'
import { useRecognitionHistory } from '@/entities/recognitionHistory'
import { formatDateTime } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { StatPill, SearchInput, TableSkeleton, ConfidenceBar } from '@/shared/ui'
import pageStyles from '@/shared/ui/page.module.css'
import styles from './HistoryPage.module.css'

export function HistoryPage() {
  const [search, setSearch] = useState('')

  const queryParams = search.length === 0 || search.length >= 2
    ? { plateNumber: search || undefined }
    : {}

  const { data: records = [], isLoading, error, refetch, isRefetching } = useRecognitionHistory(queryParams)

  const handleSearch = (value: string) => {
    setSearch(value)
  }

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.content}>
        <div className={pageStyles.statsRow}>
          <StatPill label="Показано" count={records.length} />
          <StatPill label="Известные" count={records.filter(r => r.plateGuid !== null).length} variant="green" />
          <StatPill label="Неизвестные" count={records.filter(r => r.plateGuid === null).length} variant="gray" />
          <span className={styles.liveIndicator}>
            <span className={isRefetching ? styles.liveDotActive : styles.liveDot} />
            Обновляется автоматически
          </span>
        </div>

        <div className={pageStyles.toolbar}>
          <SearchInput value={search} onChange={handleSearch} placeholder="Поиск по номеру..." />
        </div>

        <div className={pageStyles.tableWrapper}>
          {error && (
            <div className={pageStyles.stateError}>
              {getErrorMessage(error)}
              <button className={pageStyles.retryBtn} onClick={() => refetch()}>Повторить</button>
            </div>
          )}
          {!error && (
            <table className={pageStyles.table}>
              <thead>
                <tr className={pageStyles.theadRow}>
                  <th className={pageStyles.th}>ВРЕМЯ</th>
                  <th className={pageStyles.th}>НОМЕР</th>
                  <th className={pageStyles.th}>СОВПАДЕНИЕ</th>
                  <th className={pageStyles.th}>УВЕРЕННОСТЬ</th>
                  <th className={pageStyles.th}>ТОЧКА ДОСТУПА</th>
                  <th className={pageStyles.th}>КАМЕРА</th>
                  <th className={pageStyles.th}>ФОТО</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableSkeleton rows={5} cols={7} />}
                {!isLoading && records.map(record => (
                  <tr key={record.id} className={pageStyles.row}>
                    <td className={pageStyles.cell}>
                      <span className={styles.datetime}>{formatDateTime(record.occurredAt)}</span>
                    </td>
                    <td className={pageStyles.cell}>
                      <span className={styles.plateNumber}>{record.plateNumber}</span>
                    </td>
                    <td className={pageStyles.cell}>
                      {record.plateGuid !== null ? (
                        <span className={styles.matchBadge}>В базе</span>
                      ) : (
                        <span className={styles.unknownBadge}>Неизвестен</span>
                      )}
                    </td>
                    <td className={pageStyles.cell}>
                      <ConfidenceBar value={record.confidence} />
                    </td>
                    <td className={pageStyles.cell}>
                      {record.accessPointId !== null ? (
                        <span className={styles.apBadge}>#{record.accessPointId}</span>
                      ) : (
                        <span className={styles.dash}>—</span>
                      )}
                    </td>
                    <td className={pageStyles.cell}>
                      <span className={styles.cameraId} title={record.cameraGuid}>
                        {record.cameraGuid.slice(0, 8)}…
                      </span>
                    </td>
                    <td className={pageStyles.cell}>
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
                {!isLoading && records.length === 0 && (
                  <tr>
                    <td colSpan={7} className={pageStyles.stateMessage}>Записей не найдено</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
