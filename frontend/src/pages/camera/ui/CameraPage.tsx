import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Camera, UpdateCameraDto } from '@/entities/camera'
import { cameraApi, useCameraSnapshot } from '@/entities/camera'
import { useAccessPoints } from '@/entities/accessPoint'
import { useToast, formatDate } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { Icon, Toggle, PageHeader, StatusDot, ZoneEditor } from '@/shared/ui'
import type { ZoneConfig } from '@/shared/ui'

export function CameraPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [camera, setCamera] = useState<Camera | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState<UpdateCameraDto>({})
  const [showAuth, setShowAuth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [zone, setZone] = useState<ZoneConfig | null>(null)
  const { snapshotUrl, snapshotLoading } = useCameraSnapshot(id)
  const { showToast } = useToast()
  const { data: accessPoints = [] } = useAccessPoints()

  useEffect(() => {
    let cancelled = false
    cameraApi
      .get(id)
      .then(data => {
        if (!cancelled) {
          setCamera(data)
          setShowAuth(!!(data.login))
          setForm({
            name: data.name,
            stream: data.stream,
            streamHd: data.streamHd,
            login: data.login ?? '',
            password: data.password ?? '',
            accessPointId: data.accessPointId,
            isEnabled: data.isEnabled,
          })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  const set = (field: keyof UpdateCameraDto, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!form.name?.trim()) e.name = 'Обязательное поле'
    if (!form.stream?.trim()) e.stream = 'Укажите RTSP-адрес потока'
    if (!form.streamHd?.trim()) e.streamHd = 'Укажите RTSP-адрес потока'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setSaving(true)
    try {
      const updated = await cameraApi.update(id, {
        ...form,
        login: showAuth ? (form.login || null) : null,
        password: showAuth ? (form.password || null) : null,
        metadata: { ...(camera?.metadata ?? {}), ...(zone ? { zone } : {}) },
      })
      setCamera(updated)
      showToast('Камера обновлена')
    } catch (err) {
      showToast(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Удалить камеру «${camera?.name}»? Это действие нельзя отменить.`)) return
    try {
      await cameraApi.delete(id)
      navigate('/cameras')
    } catch (err) {
      showToast(getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Загрузка…" crumbs="Камеры" />
        <div className="content">
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--fg-subtle)' }}>Загрузка камеры…</div>
        </div>
      </>
    )
  }

  if (loadError || !camera) {
    return (
      <>
        <PageHeader title="Ошибка" crumbs="Камеры" actions={<button className="btn" onClick={() => navigate('/cameras')}>← Назад</button>} />
        <div className="content">
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--danger)' }}>{loadError ?? 'Камера не найдена'}</div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={camera.name}
        crumbs={`Камеры · Редактирование`}
        actions={
          <>
            <button
              className="btn"
              style={{ color: 'var(--danger)' }}
              onClick={handleDelete}
            >
              <Icon name="trash" /> Удалить
            </button>
            <button className="btn" onClick={() => navigate('/cameras')}>Отмена</button>
            <button className="btn btn-accent" onClick={handleSave} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </>
        }
      />

      <div className="content">
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Основное */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">Основное</div>
              <StatusDot kind={camera.isEnabled ? 'active' : 'off'} label={camera.isEnabled ? 'Активна' : 'Отключена'} />
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Название</label>
                <input
                  className={`input ${errors.name ? 'has-error' : ''}`}
                  placeholder="Например: Главные ворота — въезд"
                  value={form.name ?? ''}
                  onChange={e => set('name', e.target.value)}
                />
                {errors.name && <div className="field-error">{errors.name}</div>}
              </div>
              <div className="field">
                <label>Точка доступа</label>
                <select
                  className="select"
                  value={form.accessPointId ?? ''}
                  onChange={e => set('accessPointId', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Без привязки —</option>
                  {accessPoints.map(ap => (
                    <option key={ap.id} value={ap.id}>{ap.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Активна</div>
                    <div className="text-xs text-subtle">Если выключена, кадры не обрабатываются</div>
                  </div>
                  <Toggle on={form.isEnabled ?? true} onChange={v => set('isEnabled', v)} />
                </div>
              </div>
              <div className="text-xs text-subtle">
                Добавлена: {formatDate(camera.createdAt)} · Обновлена: {formatDate(camera.updatedAt)}
              </div>
            </div>
          </div>

          {/* RTSP потоки */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">Видеопотоки RTSP</div>
              <div className="section-meta">SD — распознавание, HD — снимки</div>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>SD поток (распознавание)</label>
                <input
                  className={`input mono ${errors.stream ? 'has-error' : ''}`}
                  value={form.stream ?? ''}
                  onChange={e => set('stream', e.target.value)}
                  placeholder="rtsp://login:pass@host:554/..."
                />
                {errors.stream && <div className="field-error">{errors.stream}</div>}
              </div>
              <div className="field">
                <label>HD поток (снимок)</label>
                <input
                  className={`input mono ${errors.streamHd ? 'has-error' : ''}`}
                  value={form.streamHd ?? ''}
                  onChange={e => set('streamHd', e.target.value)}
                  placeholder="rtsp://login:pass@host:554/..."
                />
                {errors.streamHd && <div className="field-error">{errors.streamHd}</div>}
              </div>
            </div>
          </div>

          {/* Авторизация */}
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Авторизация</div>
                <div className="text-xs text-subtle" style={{ marginTop: 2 }}>Логин и пароль для RTSP-потока</div>
              </div>
              <Toggle on={showAuth} onChange={setShowAuth} aria-label="Требуется авторизация" />
            </div>
            {showAuth && (
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field-row cols-2">
                  <div className="field">
                    <label>Логин</label>
                    <input
                      className="input"
                      placeholder="admin"
                      value={form.login ?? ''}
                      onChange={e => set('login', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Пароль</label>
                    <input
                      className="input"
                      type="password"
                      placeholder="••••••••"
                      value={form.password ?? ''}
                      onChange={e => set('password', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Область распознавания */}
          {camera && (
            <ZoneEditor
              key={camera.guid}
              isEnabled={form.isEnabled ?? true}
              snapshotUrl={snapshotUrl}
              snapshotLoading={snapshotLoading}
              defaultValue={camera.metadata?.zone as ZoneConfig | undefined}
              onChange={setZone}
            />
          )}

        </div>
      </div>
    </>
  )
}
