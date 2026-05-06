import { useState, useMemo } from 'react'
import type { Plate, CreatePlateDto, UpdatePlateDto } from '@/entities/plate'
import { usePlates, useDeletePlate, useCreatePlate, useUpdatePlate, useImportPlates, usePreviewImport } from '@/entities/plate'
import { useAccessPoints } from '@/entities/accessPoint'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { TableSkeleton, ConfirmDialog, Icon, PageHeader, PlateBadge, Toggle, CsvImportModal } from '@/shared/ui'

const EMPTY_FORM: CreatePlateDto = { number: '', region: '', accessType: 'allowed', comment: '', isEnabled: true, accessPointIds: [] }

const ACCESS_LABELS: Record<string, string> = { allowed: 'Разрешён', blocked: 'Заблокирован', vip: 'VIP' }
const ACCESS_TAG: Record<string, string> = { allowed: 'tag tag-success', blocked: 'tag tag-danger', vip: 'tag tag-accent' }

type FilterType = 'all' | 'allowed' | 'blocked' | 'vip'

export function PlatesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<CreatePlateDto>(EMPTY_FORM)
  const [editingPlate, setEditingPlate] = useState<Plate | null>(null)
  const [editForm, setEditForm] = useState<UpdatePlateDto>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const { showToast } = useToast()

  const { data: plates = [], isLoading, error, refetch } = usePlates()
  const { data: accessPoints = [] } = useAccessPoints()
  const accessPointMap = useMemo(() => new Map(accessPoints.map(ap => [ap.id, ap])), [accessPoints])
  const deletePlate = useDeletePlate()
  const createPlate = useCreatePlate()
  const updatePlate = useUpdatePlate()
  const importPlates = useImportPlates()
  const previewImport = usePreviewImport()

  const handlePreviewRequest = (file: File) => {
    previewImport.mutate(file)
  }

  const handleImport = (file: File) => {
    importPlates.mutate(file, {
      onSuccess: (res) => setImportResult(res),
      onError: (err) => showToast(getErrorMessage(err)),
    })
  }

  const handleImportClose = () => {
    setShowImport(false)
    setImportResult(null)
    importPlates.reset()
    previewImport.reset()
  }

  const handleDelete = () => {
    if (!deletingId) return
    deletePlate.mutate(deletingId, {
      onError: (err: unknown) => showToast(getErrorMessage(err)),
      onSettled: () => setDeletingId(null),
    })
  }

  const handleBulkDelete = () => {
    if (selected.size === 0) return
    if (!confirm(`Удалить ${selected.size} номеров? Это действие нельзя отменить.`)) return
    const ids = [...selected]
    ids.forEach(id => deletePlate.mutate(id, { onError: (err) => showToast(getErrorMessage(err)) }))
    setSelected(new Set())
  }

  const startEdit = (plate: Plate) => {
    setEditingPlate(plate)
    setEditForm({
      number: plate.number,
      region: plate.region,
      accessType: plate.accessType,
      comment: plate.comment,
      isEnabled: plate.isEnabled,
      accessPointIds: plate.accessPointIds ?? [],
    })
  }

  const handleUpdate = () => {
    if (!editingPlate) return
    updatePlate.mutate(
      { id: editingPlate.guid, data: editForm },
      {
        onSuccess: () => setEditingPlate(null),
        onError: (err: unknown) => showToast(getErrorMessage(err)),
      }
    )
  }

  const handleCreate = () => {
    if (!form.number.trim()) return
    createPlate.mutate(form, {
      onSuccess: () => { setShowAdd(false); setForm(EMPTY_FORM) },
      onError: (err: unknown) => showToast(getErrorMessage(err)),
    })
  }

  const toggleSelect = (guid: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(guid)) next.delete(guid)
      else next.add(guid)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => p.guid)))
  }

  const filtered = plates.filter(p => {
    const matchesSearch = p.number.toLowerCase().includes(search.toLowerCase()) ||
      p.region.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || p.accessType === filter
    return matchesSearch && matchesFilter
  })

  const deletingPlate = plates.find(p => p.guid === deletingId)

  const chips: Array<{ id: FilterType; label: string; count: number }> = [
    { id: 'all', label: 'Все', count: plates.length },
    { id: 'allowed', label: 'Разрешены', count: plates.filter(p => p.accessType === 'allowed').length },
    { id: 'blocked', label: 'Заблокированы', count: plates.filter(p => p.accessType === 'blocked').length },
    { id: 'vip', label: 'VIP', count: plates.filter(p => p.accessType === 'vip').length },
  ]

  return (
    <>
      {deletingId && (
        <ConfirmDialog
          message={`Удалить номер «${deletingPlate?.number}»? Это действие нельзя отменить.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {showImport && (
        <CsvImportModal
          onClose={handleImportClose}
          onPreviewRequest={handlePreviewRequest}
          preview={previewImport.data}
          isPreviewLoading={previewImport.isPending}
          previewError={previewImport.error ? getErrorMessage(previewImport.error) : null}
          onImport={handleImport}
          isPending={importPlates.isPending}
          importResult={importResult}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Новый номерной знак</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}><Icon name="x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field-row cols-2">
                  <div className="field">
                    <label>Номер *</label>
                    <input
                      className="input"
                      placeholder="А123БВ77"
                      value={form.number}
                      onChange={e => setForm(p => ({ ...p, number: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label>Регион</label>
                    <input
                      className="input"
                      placeholder="77"
                      value={form.region ?? ''}
                      onChange={e => setForm(p => ({ ...p, region: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Тип доступа</label>
                  <select
                    className="select"
                    value={form.accessType}
                    onChange={e => setForm(p => ({ ...p, accessType: e.target.value }))}
                  >
                    <option value="allowed">Разрешён</option>
                    <option value="blocked">Заблокирован</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div className="field">
                  <label>Комментарий</label>
                  <input
                    className="input"
                    placeholder="Необязательно"
                    value={form.comment ?? ''}
                    onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                  />
                </div>
                {accessPoints.length > 0 && (
                  <div className="field">
                    <label>Ограничить точками доступа</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      {accessPoints.map(ap => (
                        <label key={ap.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={(form.accessPointIds ?? []).includes(ap.id)}
                            onChange={e => {
                              const ids = form.accessPointIds ?? []
                              setForm(p => ({
                                ...p,
                                accessPointIds: e.target.checked
                                  ? [...ids, ap.id]
                                  : ids.filter(id => id !== ap.id),
                              }))
                            }}
                          />
                          {ap.name}
                        </label>
                      ))}
                    </div>
                    <div className="field-help">
                      {(form.accessPointIds ?? []).length === 0
                        ? 'Доступ разрешён на всех точках'
                        : `Только на выбранных: ${(form.accessPointIds ?? []).length}`}
                    </div>
                  </div>
                )}
                <div className="field">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ marginBottom: 0 }}>Активен</label>
                    <Toggle on={form.isEnabled ?? true} onChange={v => setForm(p => ({ ...p, isEnabled: v }))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <span />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>Отмена</button>
                <button className="btn btn-accent" onClick={handleCreate} disabled={createPlate.isPending || !form.number.trim()}>
                  {createPlate.isPending ? 'Создание…' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingPlate && (
        <div className="modal-backdrop" onClick={() => setEditingPlate(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Редактирование номера</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setEditingPlate(null)}><Icon name="x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field-row cols-2">
                  <div className="field">
                    <label>Номер *</label>
                    <input
                      className="input"
                      value={editForm.number ?? ''}
                      onChange={e => setEditForm(p => ({ ...p, number: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Регион</label>
                    <input
                      className="input"
                      placeholder="77"
                      value={editForm.region ?? ''}
                      onChange={e => setEditForm(p => ({ ...p, region: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Тип доступа</label>
                  <select
                    className="select"
                    value={editForm.accessType ?? 'allowed'}
                    onChange={e => setEditForm(p => ({ ...p, accessType: e.target.value }))}
                  >
                    <option value="allowed">Разрешён</option>
                    <option value="blocked">Заблокирован</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div className="field">
                  <label>Комментарий</label>
                  <input
                    className="input"
                    placeholder="Необязательно"
                    value={editForm.comment ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, comment: e.target.value }))}
                  />
                </div>
                {accessPoints.length > 0 && (
                  <div className="field">
                    <label>Ограничить точками доступа</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      {accessPoints.map(ap => (
                        <label key={ap.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={(editForm.accessPointIds ?? []).includes(ap.id)}
                            onChange={e => {
                              const ids = editForm.accessPointIds ?? []
                              setEditForm(p => ({
                                ...p,
                                accessPointIds: e.target.checked
                                  ? [...ids, ap.id]
                                  : ids.filter(id => id !== ap.id),
                              }))
                            }}
                          />
                          {ap.name}
                        </label>
                      ))}
                    </div>
                    <div className="field-help">
                      {(editForm.accessPointIds ?? []).length === 0
                        ? 'Доступ разрешён на всех точках'
                        : `Только на выбранных: ${(editForm.accessPointIds ?? []).length}`}
                    </div>
                  </div>
                )}
                <div className="field">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ marginBottom: 0 }}>Активен</label>
                    <Toggle on={editForm.isEnabled ?? true} onChange={v => setEditForm(p => ({ ...p, isEnabled: v }))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button
                className="btn"
                style={{ color: 'var(--danger)' }}
                onClick={() => { setEditingPlate(null); setDeletingId(editingPlate.guid) }}
              >
                <Icon name="trash" /> Удалить
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setEditingPlate(null)}>Отмена</button>
                <button className="btn btn-accent" onClick={handleUpdate} disabled={updatePlate.isPending}>
                  {updatePlate.isPending ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Номерные знаки"
        crumbs="Основное"
        count={plates.length}
        actions={
          <>
            <button className="btn" onClick={() => setShowImport(true)}>
              <Icon name="upload" size={14} /> Импорт
            </button>
            <button className="btn btn-accent" onClick={() => setShowAdd(true)}>
              <Icon name="plus" /> Добавить номер
            </button>
          </>
        }
      />

      <div className="content">
        {/* Bulk selection bar */}
        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Выбрано: {selected.size}</span>
            <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={handleBulkDelete}>
              <Icon name="trash" size={13} /> Удалить выбранные
            </button>
            <button className="btn btn-sm" onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>
              Отменить выбор
            </button>
          </div>
        )}

        <div className="toolbar">
          <div className="chip-row">
            {chips.map(c => (
              <button
                key={c.id}
                className={`chip${filter === c.id ? ' active' : ''}`}
                onClick={() => setFilter(c.id)}
              >
                {c.label}
                <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.7 }}>{c.count}</span>
              </button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
            <input
              className="input"
              style={{ paddingLeft: 32 }}
              placeholder="Поиск по номеру…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
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
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Номер</th>
                  <th>Тип доступа</th>
                  <th>Точки доступа</th>
                  <th>Действителен до</th>
                  <th>Добавлен</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableSkeleton rows={5} cols={7} />}
                {!isLoading && filtered.map(plate => (
                  <PlateRow
                    key={plate.guid}
                    plate={plate}
                    accessPointMap={accessPointMap}
                    selected={selected.has(plate.guid)}
                    onSelect={() => toggleSelect(plate.guid)}
                    onEdit={() => startEdit(plate)}
                    onDelete={() => setDeletingId(plate.guid)}
                  />
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty" style={{ padding: '32px 0' }}>
                        <Icon name="plate" size={20} style={{ color: 'var(--fg-subtle)', marginBottom: 8 }} />
                        <div style={{ fontWeight: 500 }}>{search ? `Ничего не найдено по «${search}»` : 'Номеров нет'}</div>
                        {!search && (
                          <button className="btn btn-accent btn-sm" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>
                            <Icon name="plus" size={13} /> Добавить первый номер
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

interface PlateRowProps {
  plate: Plate
  accessPointMap: Map<number, { name: string }>
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

function PlateRow({ plate, accessPointMap, selected, onSelect, onEdit, onDelete }: PlateRowProps) {
  return (
    <tr
      onClick={onEdit}
      style={{ cursor: 'pointer', background: selected ? 'var(--accent-soft)' : undefined }}
    >
      <td onClick={e => { e.stopPropagation(); onSelect() }} style={{ cursor: 'default' }}>
        <input type="checkbox" checked={selected} onChange={onSelect} style={{ cursor: 'pointer' }} onClick={e => e.stopPropagation()} />
      </td>
      <td>
        <PlateBadge number={plate.number} region={plate.region} />
      </td>
      <td>
        <span className={ACCESS_TAG[plate.accessType] ?? 'tag'}>
          {ACCESS_LABELS[plate.accessType] ?? plate.accessType}
        </span>
      </td>
      <td style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>
        {plate.accessPointIds && plate.accessPointIds.length > 0
          ? plate.accessPointIds.map(id => accessPointMap.get(id)?.name ?? `#${id}`).join(', ')
          : <span style={{ color: 'var(--fg-subtle)' }}>Все</span>}
      </td>
      <td style={{ fontSize: 12.5, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
        {plate.validUntil ? formatDate(plate.validUntil) : <span style={{ color: 'var(--fg-subtle)' }}>—</span>}
      </td>
      <td style={{ fontSize: 12.5, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
        {formatDate(plate.createdAt)}
      </td>
      <td onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button
            className="btn btn-icon btn-ghost btn-sm"
            onClick={e => { e.stopPropagation(); onEdit() }}
            title="Редактировать"
          >
            <Icon name="edit" size={13} />
          </button>
          <button
            className="btn btn-icon btn-ghost btn-sm"
            style={{ color: 'var(--danger)' }}
            onClick={e => { e.stopPropagation(); onDelete() }}
            title="Удалить"
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}
