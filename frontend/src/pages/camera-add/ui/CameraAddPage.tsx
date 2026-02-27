import { useState } from 'react'
import type { CreateCameraDto } from '@/entities/camera'
import { cameraApi } from '@/entities/camera'
import { useToast } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import styles from './CameraAddPage.module.css'

const EMPTY_FORM: CreateCameraDto = {
  name: '',
  stream: '',
  streamHd: '',
  login: '',
  password: '',
  accessPointId: null,
  isEnabled: true,
}

interface CameraAddPageProps {
  onBack: () => void
  onCreated: () => void
}

export function CameraAddPage({ onBack, onCreated }: CameraAddPageProps) {
  const [form, setForm] = useState<CreateCameraDto>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const { showToast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.stream.trim() || !form.streamHd.trim()) {
      setValidationError('Заполните обязательные поля: название, поток SD и поток HD')
      return
    }
    setSaving(true)
    setValidationError(null)
    cameraApi
      .create({
        ...form,
        login: form.login || null,
        password: form.password || null,
      })
      .then(() => onCreated())
      .catch((err: unknown) => {
        showToast(getErrorMessage(err))
      })
      .finally(() => setSaving(false))
  }

  const setField =
    (field: keyof CreateCameraDto) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        field === 'accessPointId'
          ? e.target.value
            ? Number(e.target.value)
            : null
          : e.target.value
      setForm(prev => ({ ...prev, [field]: value }))
    }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <button className={styles.breadcrumbBack} onClick={onBack}>
            Система
          </button>
          <span className={styles.breadcrumbSep}>/</span>
          <button className={styles.breadcrumbBack} onClick={onBack}>
            Камеры
          </button>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>Новая камера</span>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Данные камеры</span>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.section}>
              <div className={styles.sectionLabel}>ОСНОВНОЕ</div>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label className={styles.label}>Название *</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Камера — въезд №1"
                    value={form.name}
                    onChange={setField('name')}
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>RTSP ПОТОКИ</div>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label className={styles.label}>Поток SD *</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="rtsp://192.168.1.1/stream/1"
                    value={form.stream}
                    onChange={setField('stream')}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Поток HD *</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="rtsp://192.168.1.1/stream/2"
                    value={form.streamHd}
                    onChange={setField('streamHd')}
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>АВТОРИЗАЦИЯ</div>
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
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>ДОПОЛНИТЕЛЬНО</div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>ID точки доступа</label>
                  <input
                    className={styles.input}
                    type="number"
                    placeholder="Не задано"
                    value={form.accessPointId ?? ''}
                    onChange={setField('accessPointId')}
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
              <button type="button" className={styles.btnOutline} onClick={onBack}>
                Отмена
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Сохранение...' : 'Создать камеру'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
