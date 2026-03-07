import { useState, useEffect } from 'react'
import type { Camera } from '@/entities/camera'
import { CameraRow, cameraApi } from '@/entities/camera'
import { useToast } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import styles from './CamerasPage.module.css'

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
      <path d="M1 1H12M3 5.5H10M5 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SortIcon() {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
      <path d="M4 0L7.5 4H0.5L4 0Z" fill="currentColor" />
      <path d="M4 10L0.5 6H7.5L4 10Z" fill="currentColor" />
    </svg>
  )
}

interface CamerasPageProps {
  onCameraClick?: (id: string) => void
  onAddCamera?: () => void
}

export function CamerasPage({ onCameraClick, onAddCamera }: CamerasPageProps) {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { showToast } = useToast()

  const loadCameras = () => {
    setLoading(true)
    setError(null)
    cameraApi
      .list({ limit: 100 })
      .then(data => setCameras(data))
      .catch((err: unknown) => {
        setError(getErrorMessage(err))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    cameraApi
      .list({ limit: 100 })
      .then(data => { if (!cancelled) setCameras(data) })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleDelete = (id: string) => {
    cameraApi
      .delete(id)
      .then(() => setCameras(prev => prev.filter(c => c.guid !== id)))
      .catch((err: unknown) => {
        showToast(getErrorMessage(err))
      })
  }

  const filtered = cameras.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.stream.includes(search)
  )

  const totalCount = cameras.length
  const activeCount = cameras.filter(c => c.isEnabled).length
  const disabledCount = cameras.filter(c => !c.isEnabled).length

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.statsRow}>
          <div className={styles.statPill}>
            <span className={styles.statPillLabel}>Всего</span>
            <span className={styles.statPillCount}>{totalCount}</span>
          </div>
          <div className={`${styles.statPill} ${styles.statPillGreen}`}>
            <span className={styles.statPillLabel}>Активны</span>
            <span className={styles.statPillCount}>{activeCount}</span>
          </div>
          <div className={`${styles.statPill} ${styles.statPillRed}`}>
            <span className={styles.statPillLabel}>Отключены</span>
            <span className={styles.statPillCount}>{disabledCount}</span>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>
              <SearchIcon />
            </span>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Поиск по названию или IP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.filters}>
            <button className={styles.filterBtn}>
              <FilterIcon /> Статус
            </button>
          </div>
          <span className={styles.recordsCount}>{filtered.length} записей</span>
        </div>

        <div className={styles.tableWrapper}>
          {loading && <div className={styles.stateMessage}>Загрузка...</div>}
          {error && (
            <div className={styles.stateError}>
              {error}
              <button className={styles.retryBtn} onClick={loadCameras}>Повторить</button>
            </div>
          )}
          {!loading && !error && (
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadRow}>
                  <th className={styles.th}>
                    КАМЕРА <span className={styles.sortIcon}><SortIcon /></span>
                  </th>
                  <th className={styles.th}>
                    ПОТОК SD <span className={styles.sortIcon}><SortIcon /></span>
                  </th>
                  <th className={styles.th}>
                    ПОТОК HD <span className={styles.sortIcon}><SortIcon /></span>
                  </th>
                  <th className={styles.th}>
                    СТАТУС <span className={styles.sortIcon}><SortIcon /></span>
                  </th>
                  <th className={styles.th}>
                    ТОЧКА ДОСТУПА <span className={styles.sortIcon}><SortIcon /></span>
                  </th>
                  <th className={styles.th}>
                    ДОБАВЛЕНА <span className={styles.sortIcon}><SortIcon /></span>
                  </th>
                  <th className={styles.th} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(camera => (
                  <CameraRow
                    key={camera.guid}
                    camera={camera}
                    onClick={onCameraClick}
                    onDelete={handleDelete}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className={styles.stateMessage}>Камеры не найдены</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.tableFooter}>
          <button className={styles.addLink} onClick={onAddCamera}>
            + Добавить камеру
          </button>
        </div>
      </div>
    </div>
  )
}
