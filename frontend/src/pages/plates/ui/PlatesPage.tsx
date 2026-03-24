import { useState, useRef } from 'react'
import type { Plate, CreatePlateDto, ImportPreviewRow, ImportPreviewResponse } from '@/entities/plate'
import { usePlates, useDeletePlate, useCreatePlate, useUpdatePlate, usePreviewImport, useImportPlates } from '@/entities/plate'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { StatPill, SearchInput, TableSkeleton, ConfirmDialog, Modal, StatusBadge } from '@/shared/ui'
import pageStyles from '@/shared/ui/page.module.css'
import formStyles from '@/shared/ui/form.module.css'
import styles from './PlatesPage.module.css'

const EMPTY_FORM: CreatePlateDto = { number: '', region: '', accessType: 'allowed', comment: '', isEnabled: true }

export function PlatesPage() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<CreatePlateDto>(EMPTY_FORM)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const { data: plates = [], isLoading, error, refetch } = usePlates()
  const deletePlate = useDeletePlate()
  const createPlate = useCreatePlate()
  const updatePlate = useUpdatePlate()
  const previewImport = usePreviewImport()
  const importPlates = useImportPlates()

  const handleImportClose = () => {
    setShowImport(false)
    setImportFile(null)
    setPreview(null)
    previewImport.reset()
    importPlates.reset()
  }

  const handleFileSelect = (file: File) => {
    setImportFile(file)
    setPreview(null)
    previewImport.mutate(file, {
      onSuccess: (data) => setPreview(data),
      onError: (err) => showToast(getErrorMessage(err)),
    })
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const downloadCsvExample = () => {
    const rows = [
      'number,region,accessType,validUntil,comment,isEnabled',
      'А123БВ77,77,allowed,,Основной въезд,true',
      'В456ГД99,99,blocked,2026-12-31T00:00:00Z,Заблокирован,true',
      'Е789ЖЗ50,50,vip,,VIP гость,true',
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plates_example.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportConfirm = () => {
    if (!importFile) return
    importPlates.mutate(importFile, {
      onSuccess: (res) => {
        showToast(`Импортировано: ${res.created}, пропущено: ${res.skipped}`)
        handleImportClose()
      },
      onError: (err) => showToast(getErrorMessage(err)),
    })
  }

  const handleDelete = () => {
    if (!deletingId) return
    deletePlate.mutate(deletingId, {
      onError: (err: unknown) => showToast(getErrorMessage(err)),
      onSettled: () => setDeletingId(null),
    })
  }

  const handleToggle = (plate: Plate) => {
    updatePlate.mutate(
      { id: plate.guid, data: { isEnabled: !plate.isEnabled } },
      { onError: (err: unknown) => showToast(getErrorMessage(err)) }
    )
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.number.trim() || !form.accessType.trim()) {
      showToast('Заполните обязательные поля: номер и тип доступа')
      return
    }
    createPlate.mutate(form, {
      onSuccess: () => {
        setShowAdd(false)
        setForm(EMPTY_FORM)
      },
      onError: (err: unknown) => showToast(getErrorMessage(err)),
    })
  }

  const filtered = plates.filter(p =>
    p.number.toLowerCase().includes(search.toLowerCase()) ||
    p.region.toLowerCase().includes(search.toLowerCase())
  )

  const deletingPlate = plates.find(p => p.guid === deletingId)

  return (
    <div className={pageStyles.page}>
      {deletingId && (
        <ConfirmDialog
          message={`Удалить номер «${deletingPlate?.number}»? Это действие нельзя отменить.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {showImport && (
        <Modal title="Импорт номеров из CSV" onClose={handleImportClose} width={880}>
          {!preview && (
            <div
              className={`${styles.dropZone} ${previewImport.isPending ? styles.dropZoneActive : ''}`}
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
              <div className={styles.dropZoneText}>
                {previewImport.isPending ? 'Загрузка...' : 'Перетащите CSV-файл сюда или нажмите для выбора'}
              </div>
              <div className={styles.dropZoneHint}>
                Формат: number, region, accessType, validUntil (RFC3339), comment, isEnabled
              </div>
            </div>
          )}

          {preview && (
            <div className={styles.previewWrap}>
              <div className={styles.previewStats}>
                <StatPill label="Будет добавлено" count={preview.totalOk} variant="green" />
                <StatPill label="Дубликаты" count={preview.totalDuplicates} />
                <StatPill label="Ошибки формата" count={preview.totalInvalid} variant="red" />
              </div>

              <div className={styles.previewTableWrap}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>НОМЕР</th>
                      <th>РЕГИОН</th>
                      <th>ТИП ДОСТУПА</th>
                      <th>ДЕЙСТВИТЕЛЕН ДО</th>
                      <th>КОММЕНТАРИЙ</th>
                      <th>СТАТУС</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(row => (
                      <ImportPreviewRowItem key={row.row} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.previewActions}>
                <button className={styles.previewChange} onClick={() => { setPreview(null); setImportFile(null) }}>
                  Выбрать другой файл
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className={formStyles.btnOutline} onClick={handleImportClose}>Отмена</button>
                  <button
                    className={formStyles.btnPrimary}
                    disabled={preview.totalOk === 0 || importPlates.isPending}
                    onClick={handleImportConfirm}
                  >
                    {importPlates.isPending ? 'Импорт...' : `Импортировать ${preview.totalOk} записей`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {showAdd && (
        <Modal title="Новый номерной знак" onClose={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>
          <form className={formStyles.form} onSubmit={handleCreate}>
            <div className={formStyles.fieldRow}>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Номер *</label>
                <input className={formStyles.input} placeholder="А123БВ77" value={form.number}
                  onChange={e => setForm(p => ({ ...p, number: e.target.value }))} />
              </div>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Регион</label>
                <input className={formStyles.input} placeholder="77" value={form.region ?? ''}
                  onChange={e => setForm(p => ({ ...p, region: e.target.value }))} />
              </div>
            </div>
            <div className={formStyles.fieldRow}>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Тип доступа *</label>
                <select className={formStyles.input} value={form.accessType}
                  onChange={e => setForm(p => ({ ...p, accessType: e.target.value }))}>
                  <option value="allowed">Разрешён</option>
                  <option value="blocked">Заблокирован</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Статус</label>
                <div className={formStyles.toggleRow}>
                  <button type="button"
                    className={`${formStyles.toggleBtn} ${form.isEnabled ? formStyles.toggleActive : ''}`}
                    onClick={() => setForm(p => ({ ...p, isEnabled: true }))}>Активен</button>
                  <button type="button"
                    className={`${formStyles.toggleBtn} ${!form.isEnabled ? formStyles.toggleInactive : ''}`}
                    onClick={() => setForm(p => ({ ...p, isEnabled: false }))}>Отключён</button>
                </div>
              </div>
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label}>Комментарий</label>
              <input className={formStyles.input} placeholder="Необязательно" value={form.comment ?? ''}
                onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
            </div>
            <div className={formStyles.formActions}>
              <button type="button" className={formStyles.btnOutline}
                onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>Отмена</button>
              <button type="submit" className={formStyles.btnPrimary} disabled={createPlate.isPending}>
                {createPlate.isPending ? 'Сохранение...' : 'Создать'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className={pageStyles.content}>
        <div className={pageStyles.statsRow}>
          <StatPill label="Всего" count={plates.length} />
          <StatPill label="Активны" count={plates.filter(p => p.isEnabled).length} variant="green" />
          <StatPill label="Заблокированы" count={plates.filter(p => p.accessType === 'blocked').length} variant="red" />
        </div>

        <div className={pageStyles.toolbar}>
          <SearchInput value={search} onChange={setSearch} placeholder="Поиск по номеру или региону..." />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={styles.importBtn} onClick={() => setShowImport(true)}>Импорт CSV</button>
            <button className={styles.importBtn} title="Скачать пример CSV" onClick={downloadCsvExample}>Пример</button>
          </div>
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
                  <th className={pageStyles.th}>НОМЕР</th>
                  <th className={pageStyles.th}>РЕГИОН</th>
                  <th className={pageStyles.th}>ТИП ДОСТУПА</th>
                  <th className={pageStyles.th}>СТАТУС</th>
                  <th className={pageStyles.th}>ДЕЙСТВИТЕЛЕН ДО</th>
                  <th className={pageStyles.th}>ДОБАВЛЕН</th>
                  <th className={pageStyles.th} />
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableSkeleton rows={5} cols={7} />}
                {!isLoading && filtered.map(plate => (
                  <PlateRowItem
                    key={plate.guid}
                    plate={plate}
                    onDeleteRequest={setDeletingId}
                    onToggle={handleToggle}
                  />
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className={pageStyles.stateMessage}>
                      {search ? `По запросу «${search}» ничего не найдено` : 'Номера не найдены'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className={pageStyles.tableFooter}>
          <button className={pageStyles.addLink} onClick={() => setShowAdd(true)}>
            + Добавить номер
          </button>
        </div>
      </div>
    </div>
  )
}

interface PlateRowItemProps {
  plate: Plate
  onDeleteRequest: (id: string) => void
  onToggle: (plate: Plate) => void
}

const ACCESS_LABELS: Record<string, string> = { allowed: 'Разрешён', blocked: 'Заблокирован', vip: 'VIP' }
const ACCESS_COLORS: Record<string, string> = { allowed: '#16a34a', blocked: '#dc2626', vip: '#7c3aed' }

const ERROR_LABELS: Record<string, string> = {
  required: 'Обязательное поле',
  too_long: 'Слишком длинный',
  invalid_value: 'Неверное значение',
  invalid_format: 'Неверный формат',
  duplicate: 'Дубликат',
}

function ImportPreviewRowItem({ row }: { row: ImportPreviewRow }) {
  const e = row.errors
  return (
    <tr>
      <td style={{ color: '#9ca3af', fontSize: 12 }}>{row.row}</td>
      <td>
        <span className={e.number ? styles.cellError : styles.cellOk}>{row.number || '—'}</span>
        {e.number && <span className={styles.fieldError}>{ERROR_LABELS[e.number] ?? e.number}</span>}
      </td>
      <td>
        <span className={e.region ? styles.cellError : styles.cellOk}>{row.region || '—'}</span>
        {e.region && <span className={styles.fieldError}>{ERROR_LABELS[e.region] ?? e.region}</span>}
      </td>
      <td>
        <span className={e.accessType ? styles.cellError : styles.cellOk}>
          {ACCESS_LABELS[row.accessType] ?? (row.accessType || '—')}
        </span>
        {e.accessType && <span className={styles.fieldError}>{ERROR_LABELS[e.accessType] ?? e.accessType}</span>}
      </td>
      <td>
        <span className={e.validUntil ? styles.cellError : styles.cellOk}>
          {row.validUntil ? formatDate(row.validUntil) : '—'}
        </span>
        {e.validUntil && <span className={styles.fieldError}>{ERROR_LABELS[e.validUntil] ?? e.validUntil}</span>}
      </td>
      <td style={{ color: '#6b7280' }}>{row.comment || '—'}</td>
      <td>
        {row.status === 'ok' && <span className={`${styles.statusBadge} ${styles.statusOk}`}>OK</span>}
        {row.status === 'duplicate' && <span className={`${styles.statusBadge} ${styles.statusDupe}`}>Дубликат</span>}
        {row.status === 'invalid' && <span className={`${styles.statusBadge} ${styles.statusInvalid}`}>Ошибка</span>}
      </td>
    </tr>
  )
}

function PlateRowItem({ plate, onDeleteRequest, onToggle }: PlateRowItemProps) {
  return (
    <tr className={pageStyles.row}>
      <td className={pageStyles.cell}><span className={styles.plateNumber}>{plate.number}</span></td>
      <td className={pageStyles.cell}><span className={styles.regionBadge}>{plate.region || '—'}</span></td>
      <td className={pageStyles.cell}>
        <span className={styles.accessBadge} style={{ color: ACCESS_COLORS[plate.accessType] ?? '#374151' }}>
          {ACCESS_LABELS[plate.accessType] ?? plate.accessType}
        </span>
      </td>
      <td className={pageStyles.cell}>
        <StatusBadge
          active={plate.isEnabled}
          activeLabel="АКТИВЕН"
          inactiveLabel="ОТКЛЮЧЁН"
          onClick={() => onToggle(plate)}
        />
      </td>
      <td className={pageStyles.cell}>
        <span className={styles.date}>{plate.validUntil ? formatDate(plate.validUntil) : '—'}</span>
      </td>
      <td className={pageStyles.cell}>
        <span className={styles.date}>{formatDate(plate.createdAt)}</span>
      </td>
      <td className={pageStyles.actionCell}>
        <button className={pageStyles.deleteBtn} onClick={() => onDeleteRequest(plate.guid)} title="Удалить">
          <svg width="14" height="15" viewBox="0 0 14 15" fill="none"><path d="M1 3.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M4.5 3.5V2.5C4.5 1.95 4.95 1.5 5.5 1.5H8.5C9.05 1.5 9.5 1.95 9.5 2.5V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M2.5 3.5L3.5 12.5C3.5 13.05 3.95 13.5 4.5 13.5H9.5C10.05 13.5 10.5 13.05 10.5 12.5L11.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </td>
    </tr>
  )
}
