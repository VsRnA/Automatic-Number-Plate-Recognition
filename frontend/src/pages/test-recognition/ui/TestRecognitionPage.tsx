import { useRef, useState } from 'react'
import { API_BASE_URL } from '@/shared/config'
import styles from './TestRecognitionPage.module.css'

interface Detection {
  plateNumber: string
  confidence: number
  screenshotUrl: string
  frameNumber: number
}

interface RecognizeResult {
  success: boolean
  totalFramesWithPlates: number
  detections: Detection[]
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626'
  return (
    <div className={styles.confidenceRow}>
      <div className={styles.confidenceBar}>
        <div className={styles.confidenceFill} style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className={styles.confidenceLabel} style={{ color }}>{pct}%</span>
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1V10M7.5 1L4.5 4M7.5 1L10.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 11V12.5C1 13.3284 1.67157 14 2.5 14H12.5C13.3284 14 14 13.3284 14 12.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function TestRecognitionPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecognizeResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setResult(null)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('video', file)

    try {
      const resp = await fetch(`${API_BASE_URL}/test/recognize-video`, {
        method: 'POST',
        body: formData,
      })
      if (!resp.ok) {
        const json = await resp.json().catch(() => null)
        throw new Error(json?.error ?? `HTTP ${resp.status}`)
      }
      const data: RecognizeResult = await resp.json()
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.uploadCard}>
          <div className={styles.uploadTitle}>ТЕСТОВОЕ ВИДЕО</div>
          <div className={styles.uploadRow}>
            <label className={styles.fileLabel}>
              <UploadIcon />
              Выбрать файл
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
              />
            </label>
            {file
              ? <span className={styles.fileName}>{file.name}</span>
              : <span className={styles.noFile}>Файл не выбран</span>
            }
            <button
              className={styles.btnPrimary}
              onClick={handleSubmit}
              disabled={!file || loading}
            >
              {loading ? 'Обработка...' : 'Распознать'}
            </button>
          </div>
          {loading && (
            <div className={styles.progressRow}>
              <div className={styles.spinner} />
              <span className={styles.noFile}>Видео обрабатывается, подождите...</span>
            </div>
          )}
        </div>

        {error && (
          <div className={styles.resultsCard}>
            <div className={styles.stateError}>{error}</div>
          </div>
        )}

        {result && (
          <div className={styles.resultsCard}>
            <div className={styles.resultsHeader}>
              <span className={styles.resultsTitle}>Результаты распознавания</span>
              <span className={styles.countBadge}>{result.detections.length} номеров</span>
            </div>
            {result.detections.length === 0 ? (
              <div className={styles.stateMessage}>Номерные знаки не обнаружены</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr className={styles.theadRow}>
                    <th className={styles.th}>НОМЕР</th>
                    <th className={styles.th}>УВЕРЕННОСТЬ</th>
                    <th className={styles.th}>КАДР</th>
                    <th className={styles.th}>ФОТО</th>
                  </tr>
                </thead>
                <tbody>
                  {result.detections.map((d, i) => (
                    <tr key={i} className={styles.row}>
                      <td className={styles.cell}>
                        <span className={styles.plateNumber}>{d.plateNumber}</span>
                      </td>
                      <td className={styles.cell}>
                        <ConfidenceBar value={d.confidence} />
                      </td>
                      <td className={styles.cell}>
                        <span className={styles.frameNumber}>#{d.frameNumber}</span>
                      </td>
                      <td className={styles.cell}>
                        {d.screenshotUrl ? (
                          <a href={d.screenshotUrl} target="_blank" rel="noreferrer" className={styles.photoThumbLink}>
                            <img src={d.screenshotUrl} alt={d.plateNumber} className={styles.photoThumb} />
                          </a>
                        ) : (
                          <span className={styles.dash}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
