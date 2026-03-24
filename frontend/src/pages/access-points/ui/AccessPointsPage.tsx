import { useState } from 'react'
import type { AccessPoint, CreateAccessPointDto } from '@/entities/accessPoint'
import { useAccessPoints, useDeleteAccessPoint, useCreateAccessPoint } from '@/entities/accessPoint'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { StatPill, SearchInput, TableSkeleton, ConfirmDialog, Modal, StatusBadge } from '@/shared/ui'
import pageStyles from '@/shared/ui/page.module.css'
import formStyles from '@/shared/ui/form.module.css'
import styles from './AccessPointsPage.module.css'

const EMPTY_FORM: CreateAccessPointDto = { name: '', description: '', isEnabled: true }

export function AccessPointsPage() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<CreateAccessPointDto>(EMPTY_FORM)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { showToast } = useToast()

  const { data: items = [], isLoading, error, refetch } = useAccessPoints()
  const deleteAccessPoint = useDeleteAccessPoint()
  const createAccessPoint = useCreateAccessPoint()

  const handleDelete = () => {
    if (deletingId === null) return
    deleteAccessPoint.mutate(deletingId, {
      onError: (err: unknown) => showToast(getErrorMessage(err)),
      onSettled: () => setDeletingId(null),
    })
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.name.trim()) {
      showToast('Введите название точки доступа')
      return
    }
    createAccessPoint.mutate(form, {
      onSuccess: () => {
        setShowAdd(false)
        setForm(EMPTY_FORM)
      },
      onError: (err: unknown) => showToast(getErrorMessage(err)),
    })
  }

  const filtered = items.filter(ap =>
    ap.name.toLowerCase().includes(search.toLowerCase()) ||
    ap.description.toLowerCase().includes(search.toLowerCase())
  )

  const deletingItem = items.find(ap => ap.id === deletingId)

  return (
    <div className={pageStyles.page}>
      {deletingId !== null && (
        <ConfirmDialog
          message={`Удалить точку доступа «${deletingItem?.name}»? Это действие нельзя отменить.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {showAdd && (
        <Modal title="Новая точка доступа" onClose={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>
          <form className={formStyles.form} onSubmit={handleCreate}>
            <div className={formStyles.field}>
              <label className={formStyles.label}>Название *</label>
              <input className={formStyles.input} placeholder="Въезд №1 / Парковка A" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label}>Описание</label>
              <input className={formStyles.input} placeholder="Необязательно" value={form.description ?? ''}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label}>Статус</label>
              <div className={formStyles.toggleRow}>
                <button type="button"
                  className={`${formStyles.toggleBtn} ${form.isEnabled ? formStyles.toggleActive : ''}`}
                  onClick={() => setForm(p => ({ ...p, isEnabled: true }))}>Активна</button>
                <button type="button"
                  className={`${formStyles.toggleBtn} ${!form.isEnabled ? formStyles.toggleInactive : ''}`}
                  onClick={() => setForm(p => ({ ...p, isEnabled: false }))}>Отключена</button>
              </div>
            </div>
            <div className={formStyles.formActions}>
              <button type="button" className={formStyles.btnOutline}
                onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>Отмена</button>
              <button type="submit" className={formStyles.btnPrimary} disabled={createAccessPoint.isPending}>
                {createAccessPoint.isPending ? 'Сохранение...' : 'Создать'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className={pageStyles.content}>
        <div className={pageStyles.statsRow}>
          <StatPill label="Всего" count={items.length} />
          <StatPill label="Активны" count={items.filter(p => p.isEnabled).length} variant="green" />
        </div>

        <div className={pageStyles.toolbar}>
          <SearchInput value={search} onChange={setSearch} placeholder="Поиск по названию..." />
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
                  <th className={pageStyles.th}>ID</th>
                  <th className={pageStyles.th}>НАЗВАНИЕ</th>
                  <th className={pageStyles.th}>ОПИСАНИЕ</th>
                  <th className={pageStyles.th}>СТАТУС</th>
                  <th className={pageStyles.th}>СОЗДАНА</th>
                  <th className={pageStyles.th} />
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableSkeleton rows={5} cols={6} />}
                {!isLoading && filtered.map(ap => (
                  <AccessPointRowItem
                    key={ap.id}
                    ap={ap}
                    onDeleteRequest={setDeletingId}
                  />
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className={pageStyles.stateMessage}>
                      {search ? `По запросу «${search}» ничего не найдено` : 'Точки доступа не найдены'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className={pageStyles.tableFooter}>
          <button className={pageStyles.addLink} onClick={() => setShowAdd(true)}>
            + Добавить точку
          </button>
        </div>
      </div>
    </div>
  )
}

interface AccessPointRowItemProps {
  ap: AccessPoint
  onDeleteRequest: (id: number) => void
}

function AccessPointRowItem({ ap, onDeleteRequest }: AccessPointRowItemProps) {
  return (
    <tr className={pageStyles.row}>
      <td className={pageStyles.cell}><span className={styles.idBadge}>#{ap.id}</span></td>
      <td className={pageStyles.cell}><span className={styles.apName}>{ap.name}</span></td>
      <td className={pageStyles.cell}><span className={styles.apDesc}>{ap.description || '—'}</span></td>
      <td className={pageStyles.cell}>
        <StatusBadge
          active={ap.isEnabled}
          activeLabel="АКТИВНА"
          inactiveLabel="ОТКЛЮЧЕНА"
        />
      </td>
      <td className={pageStyles.cell}><span className={styles.date}>{formatDate(ap.createdAt)}</span></td>
      <td className={pageStyles.actionCell}>
        <button className={pageStyles.deleteBtn} onClick={() => onDeleteRequest(ap.id)}>
          <svg width="14" height="15" viewBox="0 0 14 15" fill="none"><path d="M1 3.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M4.5 3.5V2.5C4.5 1.95 4.95 1.5 5.5 1.5H8.5C9.05 1.5 9.5 1.95 9.5 2.5V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M2.5 3.5L3.5 12.5C3.5 13.05 3.95 13.5 4.5 13.5H9.5C10.05 13.5 10.5 13.05 10.5 12.5L11.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </td>
    </tr>
  )
}
