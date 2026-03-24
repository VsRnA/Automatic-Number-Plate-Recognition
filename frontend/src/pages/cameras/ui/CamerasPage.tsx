import { useState } from 'react'
import type { Camera } from '@/entities/camera'
import { useCameras, useDeleteCamera } from '@/entities/camera'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { StatPill, SearchInput, TableSkeleton, ConfirmDialog, SortIcon } from '@/shared/ui'
import pageStyles from '@/shared/ui/page.module.css'
import styles from './CamerasPage.module.css'

interface CamerasPageProps {
  onCameraClick?: (id: string) => void
  onAddCamera?: () => void
}

export function CamerasPage({ onCameraClick, onAddCamera }: CamerasPageProps) {
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { showToast } = useToast()

  const { data: cameras = [], isLoading, error, refetch } = useCameras()
  const deleteCamera = useDeleteCamera()

  const handleDelete = () => {
    if (!deletingId) return
    deleteCamera.mutate(deletingId, {
      onError: (err: unknown) => showToast(getErrorMessage(err)),
      onSettled: () => setDeletingId(null),
    })
  }

  const filtered = cameras.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.stream.includes(search)
  )

  const deletingCamera = cameras.find(c => c.guid === deletingId)

  return (
    <div className={pageStyles.page}>
      {deletingId && (
        <ConfirmDialog
          message={`Удалить камеру «${deletingCamera?.name}»? Это действие нельзя отменить.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      <div className={pageStyles.content}>
        <div className={pageStyles.statsRow}>
          <StatPill label="Всего" count={cameras.length} />
          <StatPill label="Активны" count={cameras.filter(c => c.isEnabled).length} variant="green" />
          <StatPill label="Отключены" count={cameras.filter(c => !c.isEnabled).length} variant="red" />
        </div>

        <div className={pageStyles.toolbar}>
          <SearchInput value={search} onChange={setSearch} placeholder="Поиск по названию или IP..." />
          <span className={pageStyles.recordsCount}>{filtered.length} записей</span>
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
                  <th className={pageStyles.th}>КАМЕРА <span className={pageStyles.sortIcon}><SortIcon /></span></th>
                  <th className={pageStyles.th}>ПОТОК SD</th>
                  <th className={pageStyles.th}>ПОТОК HD</th>
                  <th className={pageStyles.th}>СТАТУС</th>
                  <th className={pageStyles.th}>ТОЧКА ДОСТУПА</th>
                  <th className={pageStyles.th}>ДОБАВЛЕНА</th>
                  <th className={pageStyles.th} />
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableSkeleton rows={5} cols={7} />}
                {!isLoading && filtered.map(camera => (
                  <CameraRowItem
                    key={camera.guid}
                    camera={camera}
                    onClick={onCameraClick}
                    onDeleteRequest={setDeletingId}
                  />
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className={pageStyles.stateMessage}>
                      {search ? `По запросу «${search}» ничего не найдено` : 'Камеры не добавлены'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className={pageStyles.tableFooter}>
          <button className={pageStyles.addLink} onClick={onAddCamera}>
            + Добавить камеру
          </button>
        </div>
      </div>
    </div>
  )
}

interface CameraRowItemProps {
  camera: Camera
  onClick?: (id: string) => void
  onDeleteRequest: (id: string) => void
}

function CameraRowItem({ camera, onClick, onDeleteRequest }: CameraRowItemProps) {
  return (
    <tr
      className={`${pageStyles.row} ${onClick ? styles.rowClickable : ''}`}
      onClick={() => onClick?.(camera.guid)}
    >
      <td className={styles.nameCell}>
        <div className={styles.cameraName}>{camera.name}</div>
      </td>
      <td className={pageStyles.cell}>
        <span className={styles.streamUrl}>{camera.stream}</span>
      </td>
      <td className={pageStyles.cell}>
        <span className={styles.streamUrl}>{camera.streamHd}</span>
      </td>
      <td className={pageStyles.cell}>
        <span className={camera.isEnabled ? styles.statusActive : styles.statusDisabled}>
          <span className={styles.statusDot} />
          {camera.isEnabled ? 'Активна' : 'Отключена'}
        </span>
      </td>
      <td className={pageStyles.cell}>
        {camera.accessPointId !== null
          ? <span className={styles.apBadge}>#{camera.accessPointId}</span>
          : <span className={styles.dash}>—</span>
        }
      </td>
      <td className={pageStyles.cell}>
        <span className={styles.date}>{formatDate(camera.createdAt)}</span>
      </td>
      <td className={pageStyles.actionCell}>
        <button
          className={pageStyles.deleteBtn}
          onClick={e => { e.stopPropagation(); onDeleteRequest(camera.guid) }}
          title="Удалить камеру"
        >
          <svg width="14" height="15" viewBox="0 0 14 15" fill="none"><path d="M1 3.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M4.5 3.5V2.5C4.5 1.95 4.95 1.5 5.5 1.5H8.5C9.05 1.5 9.5 1.95 9.5 2.5V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M2.5 3.5L3.5 12.5C3.5 13.05 3.95 13.5 4.5 13.5H9.5C10.05 13.5 10.5 13.05 10.5 12.5L11.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </td>
    </tr>
  )
}
