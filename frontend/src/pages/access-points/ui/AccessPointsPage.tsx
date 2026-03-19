import { useState, useEffect } from 'react'
import type { AccessPoint, CreateAccessPointDto } from '@/entities/accessPoint'
import { accessPointApi } from '@/entities/accessPoint'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import styles from './AccessPointsPage.module.css'

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const EMPTY_FORM: CreateAccessPointDto = { name: '', description: '', isEnabled: true }

export function AccessPointsPage() {
  const [items, setItems] = useState<AccessPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<CreateAccessPointDto>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const load = () => {
    setLoading(true)
    setError(null)
    accessPointApi.list({ limit: 100 })
      .then(data => setItems(data))
      .catch((err: unknown) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    accessPointApi.list({ limit: 100 })
      .then(data => { if (!cancelled) setItems(data) })
      .catch((err: unknown) => { if (!cancelled) setError(getErrorMessage(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleDelete = (id: number) => {
    accessPointApi.delete(id)
      .then(() => setItems(prev => prev.filter(p => p.id !== id)))
      .catch((err: unknown) => showToast(getErrorMessage(err)))
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      showToast('Введите название точки доступа')
      return
    }
    setSaving(true)
    accessPointApi.create(form)
      .then(created => {
        setItems(prev => [...prev, created])
        setShowAdd(false)
        setForm(EMPTY_FORM)
      })
      .catch((err: unknown) => showToast(getErrorMessage(err)))
      .finally(() => setSaving(false))
  }

  const filtered = items.filter(ap =>
    ap.name.toLowerCase().includes(search.toLowerCase()) ||
    ap.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={styles.page}>
      {showAdd && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Новая точка доступа</span>
              <button className={styles.modalClose} onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>✕</button>
            </div>
            <form className={styles.form} onSubmit={handleCreate}>
              <div className={styles.field}>
                <label className={styles.label}>Название *</label>
                <input className={styles.input} placeholder="Въезд №1 / Парковка A" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Описание</label>
                <input className={styles.input} placeholder="Необязательно" value={form.description ?? ''}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Статус</label>
                <div className={styles.toggleRow}>
                  <button type="button" className={`${styles.toggleBtn} ${form.isEnabled ? styles.toggleActive : ''}`}
                    onClick={() => setForm(p => ({ ...p, isEnabled: true }))}>Активна</button>
                  <button type="button" className={`${styles.toggleBtn} ${!form.isEnabled ? styles.toggleInactive : ''}`}
                    onClick={() => setForm(p => ({ ...p, isEnabled: false }))}>Отключена</button>
                </div>
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
            <span className={styles.statPillCount}>{items.length}</span>
          </div>
          <div className={`${styles.statPill} ${styles.statPillGreen}`}>
            <span className={styles.statPillLabel}>Активны</span>
            <span className={styles.statPillCount}>{items.filter(p => p.isEnabled).length}</span>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}><SearchIcon /></span>
            <input className={styles.searchInput} type="text" placeholder="Поиск по названию..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className={styles.recordsCount}>{filtered.length} записей</span>
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
                  <th className={styles.th}>ID</th>
                  <th className={styles.th}>НАЗВАНИЕ</th>
                  <th className={styles.th}>ОПИСАНИЕ</th>
                  <th className={styles.th}>СТАТУС</th>
                  <th className={styles.th}>СОЗДАНА</th>
                  <th className={styles.th} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(ap => (
                  <AccessPointRow key={ap.id} ap={ap} onDelete={handleDelete} />
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className={styles.stateMessage}>Точки доступа не найдены</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.tableFooter}>
          <button className={styles.addLink} onClick={() => setShowAdd(true)}>+ Добавить точку</button>
        </div>
      </div>
    </div>
  )
}

function AccessPointRow({ ap, onDelete }: { ap: AccessPoint; onDelete: (id: number) => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <tr className={styles.row}>
      <td className={styles.cell}><span className={styles.idBadge}>#{ap.id}</span></td>
      <td className={styles.cell}><span className={styles.apName}>{ap.name}</span></td>
      <td className={styles.cell}><span className={styles.apDesc}>{ap.description || '—'}</span></td>
      <td className={styles.cell}>
        <span className={ap.isEnabled ? styles.badgeActive : styles.badgeDisabled}>
          <span className={styles.badgeDot} style={{ backgroundColor: ap.isEnabled ? '#22c55e' : '#9ca3af' }} />
          {ap.isEnabled ? 'АКТИВНА' : 'ОТКЛЮЧЕНА'}
        </span>
      </td>
      <td className={styles.cell}><span className={styles.date}>{formatDate(ap.createdAt)}</span></td>
      <td className={styles.actionCell}>
        {!confirming && (
          <button className={styles.deleteBtn} onClick={() => setConfirming(true)}>
            <TrashIcon />
          </button>
        )}
        {confirming && (
          <div className={styles.confirmRow}>
            <button className={styles.confirmYes} onClick={() => { setConfirming(false); onDelete(ap.id) }}>Удалить</button>
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
