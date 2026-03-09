import { useState, useEffect } from 'react'
import type { ApiToken, CreateApiTokenResponse } from '@/entities/apiToken'
import { apiTokenApi } from '@/entities/apiToken'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import styles from './ApiTokensPage.module.css'

export function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [newToken, setNewToken] = useState<CreateApiTokenResponse | null>(null)
  const { showToast } = useToast()

  const load = () => {
    setLoading(true)
    setError(null)
    apiTokenApi.list()
      .then(data => setTokens(data))
      .catch((err: unknown) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    apiTokenApi.list()
      .then(data => { if (!cancelled) setTokens(data) })
      .catch((err: unknown) => { if (!cancelled) setError(getErrorMessage(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    apiTokenApi.create({ description })
      .then(created => {
        setTokens(prev => [created, ...prev])
        setNewToken(created)
        setShowAdd(false)
        setDescription('')
      })
      .catch((err: unknown) => showToast(getErrorMessage(err)))
      .finally(() => setSaving(false))
  }

  const handleDelete = (id: string) => {
    apiTokenApi.delete(id)
      .then(() => setTokens(prev => prev.filter(t => t.id !== id)))
      .catch((err: unknown) => showToast(getErrorMessage(err)))
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Токен скопирован в буфер обмена'))
      .catch(() => showToast('Не удалось скопировать'))
  }

  return (
    <div className={styles.page}>
      {showAdd && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Новый API токен</span>
              <button className={styles.modalClose} onClick={() => { setShowAdd(false); setDescription('') }}>✕</button>
            </div>
            <form className={styles.form} onSubmit={handleCreate}>
              <div className={styles.field}>
                <label className={styles.label}>Описание</label>
                <input
                  className={styles.input}
                  placeholder="Например: Интеграция с СКУД"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnOutline}
                  onClick={() => { setShowAdd(false); setDescription('') }}>Отмена</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? 'Создание...' : 'Создать токен'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {newToken && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Токен создан</span>
              <button className={styles.modalClose} onClick={() => setNewToken(null)}>✕</button>
            </div>
            <p className={styles.tokenWarning}>
              Сохраните токен — он показывается только один раз и не может быть восстановлен.
            </p>
            <div className={styles.tokenBox}>
              <code className={styles.tokenValue}>{newToken.token}</code>
              <button className={styles.copyBtn} onClick={() => handleCopy(newToken.token)}>
                Копировать
              </button>
            </div>
            <div className={styles.formActions}>
              <button className={styles.btnPrimary} onClick={() => setNewToken(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.toolbar}>
          <span className={styles.recordsCount}>{tokens.length} токенов</span>
          <button className={styles.btnPrimary} onClick={() => setShowAdd(true)}>+ Создать токен</button>
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
                  <th className={styles.th}>ПРЕФИКС</th>
                  <th className={styles.th}>ОПИСАНИЕ</th>
                  <th className={styles.th}>СТАТУС</th>
                  <th className={styles.th}>ПОСЛЕДНЕЕ ИСПОЛЬЗОВАНИЕ</th>
                  <th className={styles.th}>СОЗДАН</th>
                  <th className={styles.th} />
                </tr>
              </thead>
              <tbody>
                {tokens.map(token => (
                  <TokenRow key={token.id} token={token} onDelete={handleDelete} />
                ))}
                {tokens.length === 0 && (
                  <tr><td colSpan={6} className={styles.stateMessage}>Токены не созданы</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

interface TokenRowProps {
  token: ApiToken
  onDelete: (id: string) => void
}

function TokenRow({ token, onDelete }: TokenRowProps) {
  const [confirming, setConfirming] = useState(false)

  return (
    <tr className={styles.row}>
      <td className={styles.cell}>
        <code className={styles.prefix}>{token.tokenPrefix}…</code>
      </td>
      <td className={styles.cell}>{token.description || <span className={styles.muted}>—</span>}</td>
      <td className={styles.cell}>
        <span className={token.isActive ? styles.badgeActive : styles.badgeInactive}>
          <span className={styles.badgeDot} style={{ backgroundColor: token.isActive ? '#22c55e' : '#9ca3af' }} />
          {token.isActive ? 'АКТИВЕН' : 'ОТКЛЮЧЁН'}
        </span>
      </td>
      <td className={styles.cell}>
        <span className={styles.date}>{token.lastUsedAt ? formatDate(token.lastUsedAt) : '—'}</span>
      </td>
      <td className={styles.cell}>
        <span className={styles.date}>{formatDate(token.createdAt)}</span>
      </td>
      <td className={styles.actionCell}>
        {!confirming && (
          <button className={styles.deleteBtn} onClick={() => setConfirming(true)} title="Удалить">
            <TrashIcon />
          </button>
        )}
        {confirming && (
          <div className={styles.confirmRow}>
            <button className={styles.confirmYes} onClick={() => { setConfirming(false); onDelete(token.id) }}>Удалить</button>
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
