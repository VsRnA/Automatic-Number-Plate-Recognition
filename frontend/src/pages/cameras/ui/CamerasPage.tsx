import { useState, useMemo } from 'react'
import type { Camera } from '@/entities/camera'
import { useCameras, useDeleteCamera } from '@/entities/camera'
import { useAccessPoints } from '@/entities/accessPoint'
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
  const { data: accessPoints = [] } = useAccessPoints()
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

  const accessPointMap = useMemo(() => new Map(accessPoints.map(ap => [ap.id, ap])), [accessPoints])

  // Group cameras by access point; access points in API order, unassigned last
  const groups = useMemo(() => {
    const byAp = new Map<number, Camera[]>()
    const unassigned: Camera[] = []
    filtered.forEach(c => {
      if (c.accessPointId !== null) {
        const list = byAp.get(c.accessPointId) ?? []
        list.push(c)
        byAp.set(c.accessPointId, list)
      } else {
        unassigned.push(c)
      }
    })
    const result: Array<{ apId: number | null; name: string; cameras: Camera[] }> = []
    accessPoints.forEach(ap => {
      const cams = byAp.get(ap.id)
      if (cams) result.push({ apId: ap.id, name: ap.name, cameras: cams })
    })
    // Access points not in the list (AP deleted but camera still references it)
    byAp.forEach((cams, apId) => {
      if (!accessPoints.find(ap => ap.id === apId)) {
        result.push({ apId, name: `Точка #${apId}`, cameras: cams })
      }
    })
    if (unassigned.length > 0) result.push({ apId: null, name: 'Без точки доступа', cameras: unassigned })
    return result
  }, [filtered, accessPoints])

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

        {error && (
          <div className={pageStyles.tableWrapper}>
            <div className={pageStyles.stateError}>
              {getErrorMessage(error)}
              <button className={pageStyles.retryBtn} onClick={() => refetch()}>Повторить</button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className={pageStyles.tableWrapper}>
            <table className={pageStyles.table}>
              <CameraTableHead />
              <tbody><TableSkeleton rows={5} cols={7} /></tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className={pageStyles.tableWrapper}>
            <div className={pageStyles.stateMessage}>
              {search ? `По запросу «${search}» ничего не найдено` : 'Камеры не добавлены'}
            </div>
          </div>
        )}

        {!isLoading && !error && groups.map(group => (
          <div key={`group-${group.apId}`} className={styles.groupSection}>
            <div className={styles.groupLabel}>
              <span className={styles.groupLabelText}>{group.name}</span>
              <span className={styles.groupCount}>{group.cameras.length}</span>
            </div>
            <div className={pageStyles.tableWrapper}>
              <table className={pageStyles.table}>
                <CameraTableHead />
                <tbody>
                  {group.cameras.map(camera => (
                    <CameraRowItem
                      key={camera.guid}
                      camera={camera}
                      apName={group.apId !== null ? accessPointMap.get(group.apId)?.name : undefined}
                      onClick={onCameraClick}
                      onDeleteRequest={setDeletingId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className={pageStyles.tableFooter}>
          <button className={pageStyles.addLink} onClick={onAddCamera}>
            + Добавить камеру
          </button>
        </div>
      </div>
    </div>
  )
}

function CameraTableHead() {
  return (
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
  )
}

interface CameraRowItemProps {
  camera: Camera
  apName?: string
  onClick?: (id: string) => void
  onDeleteRequest: (id: string) => void
}

function CameraRowItem({ camera, apName, onClick, onDeleteRequest }: CameraRowItemProps) {
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
          ? <span className={styles.apBadge}>{apName ?? `#${camera.accessPointId}`}</span>
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
