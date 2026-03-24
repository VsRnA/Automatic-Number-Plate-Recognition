import { useState } from 'react'
import type { ApiToken, CreateApiTokenResponse } from '@/entities/apiToken'
import { useApiTokens, useDeleteApiToken, useCreateApiToken } from '@/entities/apiToken'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { TableSkeleton, ConfirmDialog, Modal, StatusBadge } from '@/shared/ui'
import pageStyles from '@/shared/ui/page.module.css'
import formStyles from '@/shared/ui/form.module.css'
import styles from './ApiTokensPage.module.css'

export function ApiTokensPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [description, setDescription] = useState('')
  const [newToken, setNewToken] = useState<CreateApiTokenResponse | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { showToast } = useToast()

  const { data: tokens = [], isLoading, error, refetch } = useApiTokens()
  const deleteApiToken = useDeleteApiToken()
  const createApiToken = useCreateApiToken()

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    createApiToken.mutate({ description }, {
      onSuccess: (created) => {
        setNewToken(created)
        setShowAdd(false)
        setDescription('')
      },
      onError: (err: unknown) => showToast(getErrorMessage(err)),
    })
  }

  const handleDelete = () => {
    if (!deletingId) return
    deleteApiToken.mutate(deletingId, {
      onError: (err: unknown) => showToast(getErrorMessage(err)),
      onSettled: () => setDeletingId(null),
    })
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Токен скопирован в буфер обмена'))
      .catch(() => showToast('Не удалось скопировать'))
  }

  const deletingToken = tokens.find(t => t.id === deletingId)

  return (
    <div className={pageStyles.page}>
      {deletingId && (
        <ConfirmDialog
          message={`Удалить токен «${deletingToken?.tokenPrefix}…»? Это действие нельзя отменить.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {showAdd && (
        <Modal title="Новый API токен" onClose={() => { setShowAdd(false); setDescription('') }}>
          <form className={formStyles.form} onSubmit={handleCreate}>
            <div className={formStyles.field}>
              <label className={formStyles.label}>Описание</label>
              <input
                className={formStyles.input}
                placeholder="Например: Интеграция с СКУД"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            <div className={formStyles.formActions}>
              <button type="button" className={formStyles.btnOutline}
                onClick={() => { setShowAdd(false); setDescription('') }}>Отмена</button>
              <button type="submit" className={formStyles.btnPrimary} disabled={createApiToken.isPending}>
                {createApiToken.isPending ? 'Создание...' : 'Создать токен'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {newToken && (
        <Modal title="Токен создан" onClose={() => setNewToken(null)}>
          <div className={styles.tokenModalBody}>
            <p className={styles.tokenWarning}>
              Сохраните токен — он показывается только один раз и не может быть восстановлен.
            </p>
            <div className={styles.tokenBox}>
              <code className={styles.tokenValue}>{newToken.token}</code>
              <button className={styles.copyBtn} onClick={() => handleCopy(newToken.token)}>
                Копировать
              </button>
            </div>
            <div className={formStyles.formActions}>
              <button className={formStyles.btnPrimary} onClick={() => setNewToken(null)}>Закрыть</button>
            </div>
          </div>
        </Modal>
      )}

      <div className={pageStyles.content}>
        <div className={pageStyles.toolbar}>
          <span className={styles.tokenCount}>{tokens.length} токенов</span>
          <button className={styles.btnCreate} onClick={() => setShowAdd(true)}>+ Создать токен</button>
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
                  <th className={pageStyles.th}>ПРЕФИКС</th>
                  <th className={pageStyles.th}>ОПИСАНИЕ</th>
                  <th className={pageStyles.th}>СТАТУС</th>
                  <th className={pageStyles.th}>ПОСЛЕДНЕЕ ИСПОЛЬЗОВАНИЕ</th>
                  <th className={pageStyles.th}>СОЗДАН</th>
                  <th className={pageStyles.th} />
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableSkeleton rows={5} cols={6} />}
                {!isLoading && tokens.map(token => (
                  <TokenRowItem
                    key={token.id}
                    token={token}
                    onDeleteRequest={setDeletingId}
                  />
                ))}
                {!isLoading && tokens.length === 0 && (
                  <tr>
                    <td colSpan={6} className={pageStyles.stateMessage}>Токены не созданы</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

interface TokenRowItemProps {
  token: ApiToken
  onDeleteRequest: (id: string) => void
}

function TokenRowItem({ token, onDeleteRequest }: TokenRowItemProps) {
  return (
    <tr className={pageStyles.row}>
      <td className={pageStyles.cell}>
        <code className={styles.prefix}>{token.tokenPrefix}…</code>
      </td>
      <td className={pageStyles.cell}>{token.description || <span className={styles.muted}>—</span>}</td>
      <td className={pageStyles.cell}>
        <StatusBadge
          active={token.isActive}
          activeLabel="АКТИВЕН"
          inactiveLabel="ОТКЛЮЧЁН"
        />
      </td>
      <td className={pageStyles.cell}>
        <span className={styles.date}>{token.lastUsedAt ? formatDate(token.lastUsedAt) : '—'}</span>
      </td>
      <td className={pageStyles.cell}>
        <span className={styles.date}>{formatDate(token.createdAt)}</span>
      </td>
      <td className={pageStyles.actionCell}>
        <button className={pageStyles.deleteBtn} onClick={() => onDeleteRequest(token.id)} title="Удалить">
          <svg width="14" height="15" viewBox="0 0 14 15" fill="none"><path d="M1 3.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M4.5 3.5V2.5C4.5 1.95 4.95 1.5 5.5 1.5H8.5C9.05 1.5 9.5 1.95 9.5 2.5V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M2.5 3.5L3.5 12.5C3.5 13.05 3.95 13.5 4.5 13.5H9.5C10.05 13.5 10.5 13.05 10.5 12.5L11.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </td>
    </tr>
  )
}
