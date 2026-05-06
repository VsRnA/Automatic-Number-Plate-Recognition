import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Camera } from '@/entities/camera'
import { useCameras, useDeleteCamera, useCameraSnapshot } from '@/entities/camera'
import { useAccessPoints } from '@/entities/accessPoint'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { TableSkeleton, ConfirmDialog, Icon, CamTile, StatusDot, PageHeader } from '@/shared/ui'

type StatusFilter = 'all' | 'active' | 'off'
type ViewMode = 'grid' | 'table'

export function CamerasPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [view, setView] = useState<ViewMode>('grid')
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

  const filtered = useMemo(() => cameras.filter(c => {
    if (statusFilter === 'active' && !c.isEnabled) return false
    if (statusFilter === 'off' && c.isEnabled) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.name.toLowerCase().includes(q) && !c.stream.includes(q)) return false
    }
    return true
  }), [cameras, statusFilter, search])

  const accessPointMap = useMemo(() => new Map(accessPoints.map(ap => [ap.id, ap])), [accessPoints])

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
    byAp.forEach((cams, apId) => {
      if (!accessPoints.find(ap => ap.id === apId)) {
        result.push({ apId, name: `Точка #${apId}`, cameras: cams })
      }
    })
    if (unassigned.length > 0) result.push({ apId: null, name: 'Без точки доступа', cameras: unassigned })
    return result
  }, [filtered, accessPoints])

  const counts = {
    all: cameras.length,
    active: cameras.filter(c => c.isEnabled).length,
    off: cameras.filter(c => !c.isEnabled).length,
  }

  const deletingCamera = cameras.find(c => c.guid === deletingId)

  return (
    <>
      {deletingId && (
        <ConfirmDialog
          message={`Удалить камеру «${deletingCamera?.name}»? Это действие нельзя отменить.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      <PageHeader
        title="Камеры"
        crumbs="Основное"
        count={cameras.length}
        actions={
          <>
            <div className="system-strip hide-mobile">
              <span className="dot" /> Система онлайн
            </div>
            <button className="btn btn-accent" onClick={() => navigate('/cameras/add')}>
              <Icon name="plus" /> Добавить камеру
            </button>
          </>
        }
      />

      <div className="content">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" className="search-icon" />
            <input
              className="input"
              placeholder="Поиск по названию или IP…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="chip-row">
            {([
              { id: 'all' as StatusFilter, label: 'Все', count: counts.all },
              { id: 'active' as StatusFilter, label: 'Активные', count: counts.active },
              { id: 'off' as StatusFilter, label: 'Отключены', count: counts.off },
            ]).map(c => (
              <button
                key={c.id}
                className={`chip ${statusFilter === c.id ? 'active' : ''}`}
                onClick={() => setStatusFilter(c.id)}
              >
                {c.label} <span className="count">{c.count}</span>
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button
              className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setView('grid')}
            >
              Плитка
            </button>
            <button
              className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setView('table')}
            >
              Таблица
            </button>
          </div>
        </div>

        {error && (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--danger)' }}>
            {getErrorMessage(error)}
            <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={() => refetch()}>Повторить</button>
          </div>
        )}

        {isLoading && (
          <div className="card">
            <table className="tbl"><tbody><TableSkeleton rows={4} cols={5} /></tbody></table>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="card">
            <div className="empty">
              <div style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 12, background: 'var(--bg-sunken)', marginBottom: 12 }}>
                <Icon name="camera" size={20} />
              </div>
              <h3>Камеры не найдены</h3>
              <div style={{ fontSize: 13, marginBottom: 14 }}>
                {search ? `По запросу «${search}» ничего не найдено` : 'Добавьте первую камеру'}
              </div>
              <button className="btn btn-accent" onClick={() => navigate('/cameras/add')}>
                <Icon name="plus" /> Добавить камеру
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && view === 'grid' && groups.map(group => (
          <div key={`g-${group.apId}`} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Icon name="gate" size={13} style={{ color: 'var(--fg-subtle)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-subtle)' }}>
                {group.name}
              </span>
              <span className="text-xs text-subtle">· {group.cameras.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {group.cameras.map(c => (
                <CameraCard
                  key={c.guid}
                  camera={c}
                  onEdit={() => navigate(`/cameras/${c.guid}`)}
                  onDelete={() => setDeletingId(c.guid)}
                />
              ))}
            </div>
          </div>
        ))}

        {!isLoading && !error && filtered.length > 0 && view === 'table' && (
          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Камера</th>
                  <th>Поток SD</th>
                  <th>Поток HD</th>
                  <th>Статус</th>
                  <th>Точка доступа</th>
                  <th>Добавлена</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.guid} style={{ cursor: 'pointer' }} onClick={() => navigate(`/cameras/${c.guid}`)}>
                    <td><strong>{c.name}</strong></td>
                    <td>
                      <span className="font-mono text-subtle text-xs" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {c.stream}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-subtle text-xs" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {c.streamHd}
                      </span>
                    </td>
                    <td><StatusDot kind={c.isEnabled ? 'active' : 'off'} /></td>
                    <td className="text-sm text-muted">
                      {c.accessPointId !== null
                        ? accessPointMap.get(c.accessPointId)?.name ?? `#${c.accessPointId}`
                        : <span className="text-subtle">—</span>}
                    </td>
                    <td className="text-subtle text-sm">{formatDate(c.createdAt)}</td>
                    <td>
                      <div className="row-actions" onClick={e => e.stopPropagation()}>
                        <button className="btn btn-icon btn-ghost" onClick={() => navigate(`/cameras/${c.guid}`)}>
                          <Icon name="edit" />
                        </button>
                        <button className="btn btn-icon btn-ghost" onClick={() => setDeletingId(c.guid)}>
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

interface CameraCardProps {
  camera: Camera
  onEdit: () => void
  onDelete: () => void
}

function CameraCard({ camera, onEdit, onDelete }: CameraCardProps) {
  const { snapshotUrl } = useCameraSnapshot(camera.guid)
  return (
    <div className="cam-card">
      <CamTile camera={camera} snapshotUrl={snapshotUrl} />
      <div className="cam-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="cam-card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {camera.name}
            </div>
          </div>
          <StatusDot kind={camera.isEnabled ? 'active' : 'off'} />
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
            <span className="text-subtle">SD</span>
            <span className="font-mono text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {camera.stream}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
            <span className="text-subtle">HD</span>
            <span className="font-mono text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {camera.streamHd}
            </span>
          </div>
        </div>
      </div>
      <div className="cam-card-foot">
        <span>{formatDate(camera.createdAt)}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm btn-ghost" onClick={e => { e.stopPropagation(); onDelete() }}>
            <Icon name="trash" size={12} />
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onEdit}>
            <Icon name="edit" size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
