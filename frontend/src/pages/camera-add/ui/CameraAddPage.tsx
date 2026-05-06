import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CreateCameraDto } from '@/entities/camera'
import { cameraApi } from '@/entities/camera'
import { useAccessPoints } from '@/entities/accessPoint'
import { useToast } from '@/shared/lib'
import { getErrorMessage } from '@/shared/api'
import { Icon, Toggle, PageHeader, ZoneEditor } from '@/shared/ui'
import type { ZoneConfig } from '@/shared/ui'

const EMPTY_FORM: CreateCameraDto = {
  name: '',
  stream: 'rtsp://',
  streamHd: 'rtsp://',
  login: '',
  password: '',
  accessPointId: null,
  isEnabled: true,
}

type Errors = Partial<Record<keyof CreateCameraDto, string>>

function validate(form: CreateCameraDto, showAuth: boolean): Errors {
  const e: Errors = {}
  if (!form.name.trim()) e.name = 'Обязательное поле'
  if (!form.stream.trim() || form.stream === 'rtsp://') e.stream = 'Укажите RTSP-адрес потока'
  if (!form.streamHd.trim() || form.streamHd === 'rtsp://') e.streamHd = 'Укажите RTSP-адрес потока'
  if (showAuth && !form.login?.trim()) e.login = 'Укажите логин'
  return e
}

export function CameraAddPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<CreateCameraDto>(EMPTY_FORM)
  const [showAuth, setShowAuth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState(false)
  const [zone, setZone] = useState<ZoneConfig | null>(null)
  const { showToast } = useToast()
  const { data: accessPoints = [] } = useAccessPoints()

  const set = (field: keyof CreateCameraDto, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    const e = validate(form, showAuth)
    setTouched(true)
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setSaving(true)
    try {
      await cameraApi.create({
        ...form,
        login: showAuth ? (form.login || null) : null,
        password: showAuth ? (form.password || null) : null,
        metadata: zone ? { zone } : undefined,
      })
      navigate('/cameras')
    } catch (err) {
      showToast(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const showErr = (field: keyof CreateCameraDto) => touched ? errors[field] : undefined

  return (
    <>
      <PageHeader
        title="Новая камера"
        crumbs="Камеры · Новая"
        actions={
          <>
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
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Название</label>
                <input
                  className={`input ${showErr('name') ? 'has-error' : ''}`}
                  placeholder="Например: Главные ворота — въезд"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                />
                {showErr('name')
                  ? <div className="field-error">{errors.name}</div>
                  : <div className="field-help">Видно в списках, истории и логах.</div>}
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
                <div className="field-help">Без точки доступа камера работает только в режиме мониторинга.</div>
              </div>
              <div className="field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Активна</div>
                    <div className="text-xs text-subtle">Если выключена, кадры не обрабатываются</div>
                  </div>
                  <Toggle on={form.isEnabled} onChange={v => set('isEnabled', v)} />
                </div>
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
                  className={`input mono ${showErr('stream') ? 'has-error' : ''}`}
                  value={form.stream}
                  onChange={e => set('stream', e.target.value)}
                  placeholder="rtsp://login:pass@host:554/..."
                />
                {showErr('stream') && <div className="field-error">{errors.stream}</div>}
              </div>
              <div className="field">
                <label>HD поток (снимок)</label>
                <input
                  className={`input mono ${showErr('streamHd') ? 'has-error' : ''}`}
                  value={form.streamHd}
                  onChange={e => set('streamHd', e.target.value)}
                  placeholder="rtsp://login:pass@host:554/..."
                />
                {showErr('streamHd') && <div className="field-error">{errors.streamHd}</div>}
              </div>
            </div>
          </div>

          {/* Авторизация */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">Авторизация</div>
              <Toggle on={showAuth} onChange={setShowAuth} aria-label="Требуется авторизация" />
            </div>
            {showAuth && (
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field-row cols-2">
                  <div className="field">
                    <label>Логин</label>
                    <input
                      className={`input ${showErr('login') ? 'has-error' : ''}`}
                      placeholder="admin"
                      value={form.login ?? ''}
                      onChange={e => set('login', e.target.value)}
                    />
                    {showErr('login') && <div className="field-error">{errors.login}</div>}
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
          <ZoneEditor isEnabled={form.isEnabled} onChange={setZone} />

          {/* Дополнительно */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">Дополнительно</div>
            </div>
            <div style={{ padding: '10px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8 }}>
                <Icon name="info" size={14} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                <span className="text-xs text-muted">После создания можно настроить модель устройства, заметку и дополнительные параметры в настройках камеры.</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
