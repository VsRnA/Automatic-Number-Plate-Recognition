import { useState } from 'react'
import type { AccessPoint, CreateAccessPointDto, UpdateAccessPointDto } from '@/entities/accessPoint'
import { useAccessPoints, useDeleteAccessPoint, useCreateAccessPoint, useUpdateAccessPoint } from '@/entities/accessPoint'
import { useCameras } from '@/entities/camera'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { TableSkeleton, ConfirmDialog, Icon, PageHeader, Toggle, StatusDot } from '@/shared/ui'

const EMPTY_FORM: CreateAccessPointDto = { name: '', description: '', isEnabled: true }

export function AccessPointsPage() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateAccessPointDto>(EMPTY_FORM)
  const [editingAp, setEditingAp] = useState<AccessPoint | null>(null)
  const [editForm, setEditForm] = useState<UpdateAccessPointDto>({})
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { showToast } = useToast()

  const { data: items = [], isLoading, error, refetch } = useAccessPoints()
  const { data: cameras = [] } = useCameras()
  const deleteAp = useDeleteAccessPoint()
  const createAp = useCreateAccessPoint()
  const updateAp = useUpdateAccessPoint()

  const handleDelete = () => {
    if (deletingId === null) return
    deleteAp.mutate(deletingId, {
      onError: (err: unknown) => showToast(getErrorMessage(err)),
      onSettled: () => setDeletingId(null),
    })
  }

  const handleCreate = () => {
    if (!form.name.trim()) return
    createAp.mutate(form, {
      onSuccess: () => { setShowForm(false); setForm(EMPTY_FORM) },
      onError: (err: unknown) => showToast(getErrorMessage(err)),
    })
  }

  const handleUpdate = () => {
    if (!editingAp) return
    updateAp.mutate(
      { id: editingAp.id, data: editForm },
      {
        onSuccess: () => setEditingAp(null),
        onError: (err: unknown) => showToast(getErrorMessage(err)),
      }
    )
  }

  const deletingItem = items.find(i => i.id === deletingId)

  return (
    <>
      {deletingId !== null && (
        <ConfirmDialog
          message={`Удалить точку доступа «${deletingItem?.name}»? Это действие нельзя отменить.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {/* Edit modal */}
      {editingAp && (
        <div className="modal-backdrop" onClick={() => setEditingAp(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Редактирование точки доступа</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setEditingAp(null)}><Icon name="x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Название</label>
                  <input
                    className="input"
                    value={editForm.name ?? editingAp.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Описание</label>
                  <input
                    className="input"
                    placeholder="Необязательно"
                    value={editForm.description ?? editingAp.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label>Активна</label>
                    <Toggle
                      on={editForm.isEnabled ?? editingAp.isEnabled}
                      onChange={v => setEditForm(f => ({ ...f, isEnabled: v }))}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button
                className="btn"
                style={{ color: 'var(--danger)' }}
                onClick={() => { setEditingAp(null); setDeletingId(editingAp.id) }}
              >
                <Icon name="trash" /> Удалить
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setEditingAp(null)}>Отмена</button>
                <button className="btn btn-accent" onClick={handleUpdate} disabled={updateAp.isPending}>
                  {updateAp.isPending ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Новая точка доступа</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowForm(false)}><Icon name="x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Название</label>
                  <input
                    className="input"
                    placeholder="Например: Въезд №1 — Главные ворота"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Описание</label>
                  <input
                    className="input"
                    placeholder="Необязательно"
                    value={form.description ?? ''}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <span />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setShowForm(false)}>Отмена</button>
                <button className="btn btn-accent" onClick={handleCreate} disabled={createAp.isPending || !form.name.trim()}>
                  {createAp.isPending ? 'Создание…' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Точки доступа"
        crumbs="Основное"
        count={items.length}
        actions={
          <button className="btn btn-accent" onClick={() => setShowForm(true)}>
            <Icon name="plus" /> Добавить точку
          </button>
        }
      />

      <div className="content">
        {error && (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--danger)' }}>
            {getErrorMessage(error)}
            <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={() => refetch()}>Повторить</button>
          </div>
        )}

        {isLoading && (
          <div className="card">
            <table className="tbl"><tbody><TableSkeleton rows={3} cols={4} /></tbody></table>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="card">
            <div className="empty">
              <div style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 12, background: 'var(--bg-sunken)', marginBottom: 12 }}>
                <Icon name="gate" size={20} />
              </div>
              <h3>Точки доступа не добавлены</h3>
              <div style={{ fontSize: 13, marginBottom: 14 }}>Создайте первую точку доступа для управления въездом</div>
              <button className="btn btn-accent" onClick={() => setShowForm(true)}>
                <Icon name="plus" /> Добавить точку
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14, alignItems: 'start' }}>
            {items.map(ap => {
              const apCameras = cameras.filter(c => c.accessPointId === ap.id)
              return (
                <AccessPointCard
                  key={ap.id}
                  ap={ap}
                  cameras={apCameras}
                  onEdit={() => {
                    setEditingAp(ap)
                    setEditForm({ name: ap.name, description: ap.description, isEnabled: ap.isEnabled })
                  }}
                  onDelete={() => setDeletingId(ap.id)}
                />
              )
            })}

            {/* Add placeholder card */}
            <button
              className="card"
              onClick={() => setShowForm(true)}
              style={{
                display: 'grid', placeItems: 'center',
                border: '1px dashed var(--line-strong)',
                background: 'transparent', minHeight: 160,
                cursor: 'pointer', color: 'var(--fg-muted)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <Icon name="plus" size={20} />
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500 }}>Добавить точку доступа</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  )
}

interface AccessPointCardProps {
  ap: AccessPoint
  cameras: Array<{ guid: string; name: string; isEnabled: boolean }>
  onEdit: () => void
  onDelete: () => void
}

function AccessPointCard({ ap, cameras, onEdit }: AccessPointCardProps) {
  return (
    <div className="card" onClick={onEdit} style={{ cursor: 'pointer' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-sunken)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="gate" size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ap.name}</div>
            {ap.description && (
              <div className="text-xs text-subtle" style={{ marginTop: 2 }}>{ap.description}</div>
            )}
          </div>
          <StatusDot kind={ap.isEnabled ? 'active' : 'off'} label={ap.isEnabled ? 'Активна' : 'Выкл'} />
        </div>
      </div>
      <div style={{ padding: '12px 18px', fontSize: 12.5 }}>
        <div className="text-subtle text-xs" style={{ marginBottom: 4 }}>Добавлена</div>
        <div className="font-mono" style={{ fontSize: 12 }}>{formatDate(ap.createdAt)}</div>
      </div>
      {cameras.length > 0 && (
        <div style={{ padding: '0 18px 14px', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div className="text-subtle text-xs" style={{ marginBottom: 6 }}>Камеры · {cameras.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {cameras.map(c => (
              <div key={c.guid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6 }}>
                <div style={{ width: 28, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #2a2f35 0%, #14171a 100%)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name="camera" size={11} style={{ color: 'rgba(255,255,255,0.55)' }} />
                </div>
                <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c.name}</span>
                <StatusDot kind={c.isEnabled ? 'active' : 'off'} label="" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
