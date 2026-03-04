import { useState, useEffect } from 'react'
import type { Plate, CreatePlateDto } from '@/entities/plate'
import { plateApi } from '@/entities/plate'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import styles from './PlatesPage.module.css'

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const EMPTY_FORM: CreatePlateDto = { number: '', region: '', accessType: 'allowed', comment: '', isEnabled: true }

export function PlatesPage() {
  const [plates, setPlates] = useState<Plate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<CreatePlateDto>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const load = () => {
    setLoading(true)
    setError(null)
    plateApi.list({ limit: 100 })
      .then(data => setPlates(data))
      .catch((err: unknown) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    plateApi.list({ limit: 100 })
      .then(data => { if (!cancelled) setPlates(data) })
      .catch((err: unknown) => { if (!cancelled) setError(getErrorMessage(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleDelete = (id: string) => {
    plateApi.delete(id)
      .then(() => setPlates(prev => prev.filter(p => p.guid !== id)))
      .catch((err: unknown) => showToast(getErrorMessage(err)))
  }

  const handleToggle = (plate: Plate) => {
    plateApi.update(plate.guid, { isEnabled: !plate.isEnabled })
      .then(updated => setPlates(prev => prev.map(p => p.guid === updated.guid ? updated : p)))
      .catch((err: unknown) => showToast(getErrorMessage(err)))
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.number.trim() || !form.accessType.trim()) {
      showToast('Заполните обязательные поля: номер и тип доступа')
      return
    }
    setSaving(true)
    plateApi.create(form)
      .then(created => {
        setPlates(prev => [created, ...prev])
        setShowAdd(false)
        setForm(EMPTY_FORM)
      })
      .catch((err: unknown) => showToast(getErrorMessage(err)))
      .finally(() => setSaving(false))
  }

  const filtered = plates.filter(p =>
    p.number.toLowerCase().includes(search.toLowerCase()) ||
    p.region.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={styles.page}>
      {showAdd && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Новый номерной знак</span>
              <button className={styles.modalClose} onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>✕</button>
            </div>
            <form className={styles.form} onSubmit={handleCreate}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Номер *</label>
                  <input className={styles.input} placeholder="А123БВ77" value={form.number}
                    onChange={e => setForm(p => ({ ...p, number: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Регион</label>
                  <input className={styles.input} placeholder="77" value={form.region ?? ''}
                    onChange={e => setForm(p => ({ ...p, region: e.target.value }))} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Тип доступа *</label>
                  <select className={styles.input} value={form.accessType}
                    onChange={e => setForm(p => ({ ...p, accessType: e.target.value }))}>
                    <option value="allowed">Разрешён</option>
                    <option value="blocked">Заблокирован</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Статус</label>
                  <div className={styles.toggleRow}>
                    <button type="button" className={`${styles.toggleBtn} ${form.isEnabled ? styles.toggleActive : ''}`}
                      onClick={() => setForm(p => ({ ...p, isEnabled: true }))}>Активен</button>
                    <button type="button" className={`${styles.toggleBtn} ${!form.isEnabled ? styles.toggleInactive : ''}`}
                      onClick={() => setForm(p => ({ ...p, isEnabled: false }))}>Отключён</button>
                  </div>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Комментарий</label>
                <input className={styles.input} placeholder="Необязательно" value={form.comment ?? ''}
                  onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnOutline}
                  onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>Отмена</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.statsRow}>
          <div className={styles.statPill}>
            <span className={styles.statPillLabel}>Всего</span>
            <span className={styles.statPillCount}>{plates.length}</span>
          </div>
          <div className={`${styles.statPill} ${styles.statPillGreen}`}>
            <span className={styles.statPillLabel}>Активны</span>
            <span className={styles.statPillCount}>{plates.filter(p => p.isEnabled).length}</span>
          </div>
          <div className={`${styles.statPill} ${styles.statPillRed}`}>
            <span className={styles.statPillLabel}>Заблокированы</span>
            <span className={styles.statPillCount}>{plates.filter(p => p.accessType === 'blocked').length}</span>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}><SearchIcon /></span>
            <input className={styles.searchInput} type="text" placeholder="Поиск по номеру или региону..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className={styles.recordsCount}>{filtered.length} записей</span>
          <button className={styles.btnPrimary} onClick={() => setShowAdd(true)}>+ Добавить номер</button>
        </div>

        <div className={styles.tableWrapper}>
          {loading && <div className={styles.stateMessage}>Загрузка...</div>}
          {error && (
            <div className={styles.stateError}>
              {error}
              <button className={styles.retryBtn} onClick={load}>Повторить</button>
            </div>
          )}
          {!loading && !error && (
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadRow}>
                  <th className={styles.th}>НОМЕР</th>
                  <th className={styles.th}>РЕГИОН</th>
                  <th className={styles.th}>ТИП ДОСТУПА</th>
                  <th className={styles.th}>СТАТУС</th>
                  <th className={styles.th}>ДЕЙСТВИТЕЛЕН ДО</th>
                  <th className={styles.th}>ДОБАВЛЕН</th>
                  <th className={styles.th} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(plate => (
                  <PlateRow key={plate.guid} plate={plate} onDelete={handleDelete} onToggle={handleToggle} />
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className={styles.stateMessage}>Номера не найдены</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

interface PlateRowProps {
  plate: Plate
  onDelete: (id: string) => void
  onToggle: (plate: Plate) => void
}

function PlateRow({ plate, onDelete, onToggle }: PlateRowProps) {
  const [confirming, setConfirming] = useState(false)

  const ACCESS_LABELS: Record<string, string> = { allowed: 'Разрешён', blocked: 'Заблокирован', vip: 'VIP' }
  const ACCESS_COLORS: Record<string, string> = { allowed: '#16a34a', blocked: '#dc2626', vip: '#7c3aed' }

  return (
    <tr className={styles.row}>
      <td className={styles.cell}><span className={styles.plateNumber}>{plate.number}</span></td>
      <td className={styles.cell}><span className={styles.regionBadge}>{plate.region || '—'}</span></td>
      <td className={styles.cell}>
        <span className={styles.accessBadge} style={{ color: ACCESS_COLORS[plate.accessType] ?? '#374151' }}>
          {ACCESS_LABELS[plate.accessType] ?? plate.accessType}
        </span>
      </td>
      <td className={styles.cell}>
        <button className={plate.isEnabled ? styles.badgeActive : styles.badgeDisabled} onClick={() => onToggle(plate)}>
          <span className={styles.badgeDot} style={{ backgroundColor: plate.isEnabled ? '#22c55e' : '#9ca3af' }} />
          {plate.isEnabled ? 'АКТИВЕН' : 'ОТКЛЮЧЁН'}
        </button>
      </td>
      <td className={styles.cell}>
        <span className={styles.date}>{plate.validUntil ? formatDate(plate.validUntil) : '—'}</span>
      </td>
      <td className={styles.cell}>
        <span className={styles.date}>{formatDate(plate.createdAt)}</span>
      </td>
      <td className={styles.actionCell}>
        {!confirming && (
          <button className={styles.deleteBtn} onClick={() => setConfirming(true)} title="Удалить">
            <TrashIcon />
          </button>
        )}
        {confirming && (
          <div className={styles.confirmRow}>
            <button className={styles.confirmYes} onClick={() => { setConfirming(false); onDelete(plate.guid) }}>Удалить</button>
            <button className={styles.confirmNo} onClick={() => setConfirming(false)}>Отмена</button>
          </div>
        )}
      </td>
    </tr>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="15" viewBox="0 0 14 15" fill="none">
      <path d="M1 3.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4.5 3.5V2.5C4.5 1.95 4.95 1.5 5.5 1.5H8.5C9.05 1.5 9.5 1.95 9.5 2.5V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.5 3.5L3.5 12.5C3.5 13.05 3.95 13.5 4.5 13.5H9.5C10.05 13.5 10.5 13.05 10.5 12.5L11.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
