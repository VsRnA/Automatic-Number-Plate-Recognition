import { useState, useRef, useEffect } from 'react'
import { Icon } from './Icon'

interface ImportRow {
  row: number
  number: string
  region: string
  accessType: string
  validUntil: string | null
  comment: string
  status: 'ok' | 'duplicate' | 'invalid'
}

interface PreviewData {
  rows: ImportRow[]
  totalOk: number
  totalDuplicates: number
  totalInvalid: number
}

interface ImportResult {
  created: number
  skipped: number
}

interface CsvImportModalProps {
  onClose: () => void
  onPreviewRequest: (file: File) => void
  preview?: PreviewData | null
  isPreviewLoading?: boolean
  previewError?: string | null
  onImport: (file: File) => void
  isPending?: boolean
  importResult?: ImportResult | null
}

const STEP_LABELS = ['Загрузка', 'Маппинг колонок', 'Валидация', 'Импорт']

interface Mapping {
  num: string
  region: string
  access: string
  validUntil: string
  owner: string
}

const DEFAULT_MAPPING: Mapping = {
  num: 'Номер',
  region: 'Регион',
  access: 'Тип доступа',
  validUntil: 'Действителен до',
  owner: 'Комментарий',
}

const CSV_COLS = ['Номер', 'Регион', 'Тип доступа', 'Действителен до', 'Комментарий', 'Группа']

const ACCESS_LABELS: Record<string, string> = { allowed: 'Разрешено', blocked: 'Отказано' }

function Stepper({ step }: { step: number }) {
  return (
    <div className="stepper">
      {STEP_LABELS.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div className={`stepper-item ${step === i ? 'active' : step > i ? 'done' : ''}`}>
            <div className="stepper-num">{step > i ? '✓' : i + 1}</div>
            <span>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && <div className="stepper-line" />}
        </div>
      ))}
    </div>
  )
}

function Step1Upload({ file, onFile }: { file: File | null; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  const downloadExample = () => {
    const rows = [
      'number,region,accessType,validUntil,comment',
      'А123БВ77,77,allowed,,Основной въезд',
      'В456ГД99,99,blocked,2026-12-31,Заблокирован',
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'plates_example.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Загрузите CSV-файл со списком номеров</h3>
        <div className="text-sm text-subtle" style={{ marginTop: 4 }}>Поддерживаются файлы до 5 МБ. Кодировка UTF-8 или Windows-1251.</div>
      </div>
      <label
        style={{
          display: 'block',
          border: `2px dashed ${file ? 'var(--accent)' : 'var(--line-strong)'}`,
          borderRadius: 12,
          padding: '40px 24px',
          textAlign: 'center',
          background: file ? 'var(--accent-soft)' : 'var(--bg)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
        {file ? (
          <div>
            <Icon name="file" size={28} />
            <div style={{ marginTop: 10, fontWeight: 500 }}>{file.name}</div>
            <div className="text-xs text-subtle" style={{ marginTop: 2 }}>
              {(file.size / 1024).toFixed(1)} КБ · готов к обработке
            </div>
          </div>
        ) : (
          <div>
            <Icon name="upload" size={28} />
            <div style={{ marginTop: 10, fontWeight: 500 }}>Перетащите файл сюда</div>
            <div className="text-xs text-subtle" style={{ marginTop: 2 }}>или нажмите, чтобы выбрать</div>
          </div>
        )}
      </label>
      <div style={{ padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Icon name="info" size={16} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Формат файла</div>
          <div className="text-xs text-subtle" style={{ marginTop: 4 }}>Первая строка — заголовки колонок. Минимум: «Номер» и «Регион».</div>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={downloadExample}>
            <Icon name="download" size={11} /> Скачать пример .csv
          </button>
        </div>
      </div>
    </div>
  )
}

function Step2Mapping({ mapping, setMapping }: { mapping: Mapping; setMapping: (m: Mapping) => void }) {
  const fields = [
    { key: 'num' as keyof Mapping, label: 'Номер ГРЗ', required: true, example: 'О157АМ' },
    { key: 'region' as keyof Mapping, label: 'Регион', required: true, example: '43' },
    { key: 'access' as keyof Mapping, label: 'Тип доступа', required: true, example: 'Разрешён' },
    { key: 'validUntil' as keyof Mapping, label: 'Действителен до', required: false, example: '31.12.2026' },
    { key: 'owner' as keyof Mapping, label: 'Владелец / комментарий', required: false, example: 'Иванов А.С.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Сопоставьте колонки</h3>
        <div className="text-sm text-subtle" style={{ marginTop: 4 }}>Сопоставьте поля системы с колонками вашего файла.</div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Поле системы</th>
              <th>Колонка файла</th>
              <th>Пример</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f.key}>
                <td>
                  <div style={{ fontWeight: 500 }}>{f.label}</div>
                  {f.required && <span className="text-xs" style={{ color: 'var(--danger)' }}>обязательно</span>}
                </td>
                <td>
                  <select
                    className="select"
                    value={mapping[f.key]}
                    onChange={e => setMapping({ ...mapping, [f.key]: e.target.value })}
                  >
                    <option value="">— не использовать —</option>
                    {CSV_COLS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="font-mono text-xs text-subtle">{f.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Step3Validate({
  preview,
  isLoading,
  error,
}: {
  preview?: PreviewData | null
  isLoading?: boolean
  error?: string | null
}) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
        <div className="spinner" />
        <div className="text-sm text-subtle">Проверка данных…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--danger)' }}>
        <Icon name="x" size={24} />
        <div style={{ marginTop: 10, fontWeight: 500 }}>Ошибка при проверке файла</div>
        <div className="text-sm text-subtle" style={{ marginTop: 4 }}>{error}</div>
      </div>
    )
  }

  if (!preview) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-subtle)' }}>
        <div className="text-sm">Нет данных для отображения</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Проверьте данные перед импортом</h3>
          <div className="text-sm text-subtle" style={{ marginTop: 4 }}>Дубликаты будут пропущены. Ошибки нужно исправить в файле.</div>
        </div>
        <div className="chip-row">
          <span className="chip">
            <span className="count" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>{preview.totalOk}</span>
            Будет добавлено
          </span>
          <span className="chip">
            <span className="count" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>{preview.totalDuplicates}</span>
            Дубликаты
          </span>
          <span className="chip">
            <span className="count" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{preview.totalInvalid}</span>
            Ошибки
          </span>
        </div>
      </div>
      <div className="card" style={{ maxHeight: 320, overflow: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th><th>Номер</th><th>Регион</th><th>Тип</th><th>До</th><th>Комментарий</th><th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map(r => (
              <tr key={r.row} style={{
                background: r.status === 'duplicate' ? 'var(--warn-soft)' : r.status === 'invalid' ? 'var(--danger-soft)' : 'transparent'
              }}>
                <td className="font-mono text-subtle">{r.row}</td>
                <td className="font-mono"><strong>{r.number}</strong></td>
                <td className="font-mono">{r.region}</td>
                <td className="text-sm">{ACCESS_LABELS[r.accessType] ?? r.accessType}</td>
                <td className="font-mono text-sm">{r.validUntil ?? '—'}</td>
                <td className="text-sm text-muted">{r.comment}</td>
                <td>
                  {r.status === 'ok' && <span className="tag tag-success">OK</span>}
                  {r.status === 'duplicate' && <span className="tag tag-warn">Дубликат</span>}
                  {r.status === 'invalid' && <span className="tag tag-danger">Ошибка</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Step4Done({ result }: { result?: ImportResult | null }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 24px' }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--success-soft)', color: 'var(--success)',
        display: 'inline-grid', placeItems: 'center', marginBottom: 14
      }}>
        <Icon name="check" size={26} />
      </div>
      <h3 style={{ margin: 0, fontSize: 16 }}>Импорт завершён</h3>
      {result && (
        <div className="text-sm text-subtle" style={{ marginTop: 6 }}>
          Добавлено: {result.created}. Пропущено: {result.skipped}.
        </div>
      )}
    </div>
  )
}

export function CsvImportModal({
  onClose,
  onPreviewRequest,
  preview,
  isPreviewLoading,
  previewError,
  onImport,
  isPending,
  importResult,
}: CsvImportModalProps) {
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [mapping, setMapping] = useState<Mapping>(DEFAULT_MAPPING)

  useEffect(() => {
    if (importResult != null && step === 2) {
      setStep(3)
    }
  }, [importResult])

  const next = () => {
    if (step === 1 && file) {
      onPreviewRequest(file)
    }
    setStep(s => Math.min(3, s + 1))
  }

  const back = () => setStep(s => Math.max(0, s - 1))

  const handleImport = () => {
    if (file) onImport(file)
  }

  const canImport = !!preview && !previewError && preview.totalOk > 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <h2>Импорт номеров из CSV</h2>
            <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" /></button>
          </div>
          <Stepper step={step} />
        </div>
        <div className="modal-body">
          {step === 0 && <Step1Upload file={file} onFile={setFile} />}
          {step === 1 && <Step2Mapping mapping={mapping} setMapping={setMapping} />}
          {step === 2 && (
            <Step3Validate
              preview={preview}
              isLoading={isPreviewLoading}
              error={previewError}
            />
          )}
          {step === 3 && <Step4Done result={importResult} />}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && step < 3 && (
              <button className="btn" onClick={back} disabled={isPending || isPreviewLoading}>
                <Icon name="chevL" /> Назад
              </button>
            )}
            {step < 2 && (
              <button className="btn btn-accent" onClick={next} disabled={step === 0 && !file}>
                Далее <Icon name="chevR" />
              </button>
            )}
            {step === 2 && (
              <button
                className="btn btn-accent"
                onClick={handleImport}
                disabled={isPending || isPreviewLoading || !canImport}
              >
                {isPending ? 'Импорт…' : 'Импортировать'}
              </button>
            )}
            {step === 3 && (
              <button className="btn btn-accent" onClick={onClose}>Готово</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
