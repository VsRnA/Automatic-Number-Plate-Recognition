import { useState, useEffect, useMemo } from 'react'
import type { Camera, UpdateCameraDto } from '@/entities/camera'
import { cameraApi } from '@/entities/camera'
import { useAccessPoints } from '@/entities/accessPoint'
import { useToast, formatDateTime } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { Dropdown } from '@/shared/ui'
import styles from './CameraPage.module.css'

interface CameraPageProps {
  id: string
  onBack: () => void
}

export function CameraPage({ id, onBack }: CameraPageProps) {
  const [camera, setCamera] = useState<Camera | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<UpdateCameraDto>({})
  const [showAuth, setShowAuth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const { showToast } = useToast()
  const { data: accessPoints = [] } = useAccessPoints()
  const accessPointMap = useMemo(() => new Map(accessPoints.map(ap => [ap.id, ap])), [accessPoints])

  useEffect(() => {
    let cancelled = false
    cameraApi
      .get(id)
      .then(data => {
        if (!cancelled) setCamera(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  const startEditing = () => {
    if (!camera) return
    const hasAuth = !!(camera.login)
    setShowAuth(hasAuth)
    setForm({
      name: camera.name,
      stream: camera.stream,
      streamHd: camera.streamHd,
      login: camera.login ?? '',
      password: camera.password ?? '',
      accessPointId: camera.accessPointId,
      isEnabled: camera.isEnabled,
    })
    setValidationError(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setValidationError(null)
  }

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.name?.trim() || !form.stream?.trim() || !form.streamHd?.trim()) {
      setValidationError('Заполните обязательные поля: название, поток SD и поток HD')
      return
    }
    setSaving(true)
    setValidationError(null)
    cameraApi
      .update(id, {
        ...form,
        login: showAuth ? (form.login || null) : null,
        password: showAuth ? (form.password || null) : null,
      })
      .then(updated => {
        setCamera(updated)
        setEditing(false)
      })
      .catch((err: unknown) => {
        showToast(getErrorMessage(err))
      })
      .finally(() => setSaving(false))
  }

  const setField =
    (field: keyof UpdateCameraDto) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
    }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.topBar}>
          <button className={styles.backLink} onClick={onBack}>← Камеры</button>
          {!loading && !error && camera && !editing && (
            <button className={styles.btnOutline} onClick={startEditing}>Редактировать</button>
          )}
        </div>
        {loading && <div className={styles.stateMessage}>Загрузка...</div>}
        {error && <div className={styles.stateError}>{error}</div>}

        {!loading && !error && camera && !editing && (
          <div className={styles.viewWrapper}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cameraTitle}>
                  <div className={styles.cameraTitleName}>{camera.name}</div>
                  <span className={camera.isEnabled ? styles.badgeActive : styles.badgeDisabled}>
                    <span
                      className={styles.badgeDot}
                      style={{ backgroundColor: camera.isEnabled ? '#22c55e' : '#9ca3af' }}
                    />
                    {camera.isEnabled ? 'АКТИВНА' : 'ОТКЛЮЧЕНА'}
                  </span>
                </div>
                <div className={styles.cameraDates}>
                  <span>Добавлена: {formatDateTime(camera.createdAt)}</span>
                  <span>Обновлена: {formatDateTime(camera.updatedAt)}</span>
                </div>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>RTSP ПОТОКИ</div>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>Поток SD</div>
                      <div className={styles.infoValue}>{camera.stream}</div>
                    </div>
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>Поток HD</div>
                      <div className={styles.infoValue}>{camera.streamHd}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionLabel}>АВТОРИЗАЦИЯ</div>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>Логин</div>
                      <div className={styles.infoValue}>{camera.login ?? '—'}</div>
                    </div>
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>Пароль</div>
                      <div className={styles.infoValue}>
                        {camera.password ? '••••••••' : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionLabel}>ДОПОЛНИТЕЛЬНО</div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Точка доступа</div>
                    <div className={styles.infoValue}>
                      {camera.accessPointId !== null
                        ? (accessPointMap.get(camera.accessPointId)?.name ?? `#${camera.accessPointId}`)
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && camera && editing && (
          <div className={styles.editWrapper}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Редактирование камеры</span>
              </div>

              <form className={styles.form} onSubmit={handleSave}>
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>ОСНОВНОЕ</div>
                  <div className={styles.field}>
                    <label className={styles.label}>Название *</label>
                    <input
                      className={styles.input}
                      type="text"
                      value={form.name ?? ''}
                      onChange={setField('name')}
                    />
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionLabel}>RTSP ПОТОКИ</div>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Поток SD *</label>
                      <input
                        className={styles.input}
                        type="text"
                        value={form.stream ?? ''}
                        onChange={setField('stream')}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Поток HD *</label>
                      <input
                        className={styles.input}
                        type="text"
                        value={form.streamHd ?? ''}
                        onChange={setField('streamHd')}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionLabel}>АВТОРИЗАЦИЯ</div>
                    <label className={styles.authToggle}>
                      <input
                        type="checkbox"
                        checked={showAuth}
                        onChange={e => setShowAuth(e.target.checked)}
                      />
                      Требуется авторизация
                    </label>
                  </div>
                  {showAuth && (
                    <div className={styles.fieldRow}>
                      <div className={styles.field}>
                        <label className={styles.label}>Логин</label>
                        <input
                          className={styles.input}
                          type="text"
                          placeholder="admin"
                          value={form.login ?? ''}
                          onChange={setField('login')}
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Пароль</label>
                        <input
                          className={styles.input}
                          type="password"
                          placeholder="••••••••"
                          value={form.password ?? ''}
                          onChange={setField('password')}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionLabel}>ДОПОЛНИТЕЛЬНО</div>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Точка доступа</label>
                      <Dropdown
                        value={form.accessPointId ?? ''}
                        options={[
                          { value: '', label: 'Не задано' },
                          ...accessPoints.map(ap => ({ value: ap.id, label: ap.name })),
                        ]}
                        onChange={v => setForm(prev => ({ ...prev, accessPointId: v ? Number(v) : null }))}
                        placeholder="Не задано"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Статус</label>
                      <div className={styles.toggleRow}>
                        <button
                          type="button"
                          className={`${styles.toggleBtn} ${form.isEnabled ? styles.toggleActive : ''}`}
                          onClick={() => setForm(prev => ({ ...prev, isEnabled: true }))}
                        >
                          Активна
                        </button>
                        <button
                          type="button"
                          className={`${styles.toggleBtn} ${!form.isEnabled ? styles.toggleInactive : ''}`}
                          onClick={() => setForm(prev => ({ ...prev, isEnabled: false }))}
                        >
                          Отключена
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {validationError && <div className={styles.error}>{validationError}</div>}

                <div className={styles.actions}>
                  <button type="button" className={styles.btnOutline} onClick={cancelEditing}>
                    Отмена
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={saving}>
                    {saving ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
