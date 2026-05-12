import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import { useCamera } from '@/entities/camera'
import { getAuthHeader } from '@/shared/auth'
import { API_BASE_URL } from '@/shared/config'
import { Icon, PageHeader } from '@/shared/ui'

export function CameraLivePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const { data: camera } = useCamera(id ?? '')

  useEffect(() => {
    if (!id || !videoRef.current) return

    const video = videoRef.current
    const streamUrl = `${API_BASE_URL}/cameras/${id}/hls/index.m3u8`

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          const authHeader = getAuthHeader()
          if (authHeader) {
            xhr.setRequestHeader('Authorization', authHeader)
          }
        },
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 4,
      })

      hlsRef.current = hls

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
        setStatus('playing')
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setStatus('error')
          setErrorMsg('Не удалось воспроизвести поток. Проверьте, что камера включена.')
        }
      })

      hls.loadSource(streamUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {})
        setStatus('playing')
      })
    } else {
      setStatus('error')
      setErrorMsg('Ваш браузер не поддерживает HLS-потоки.')
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [id])

  return (
    <>
      <PageHeader
        title={camera?.name ?? 'Прямой эфир'}
        crumbs={`Камеры · ${camera?.name ?? '…'} · Эфир`}
        actions={
          <button className="btn" onClick={() => navigate(`/cameras/${id}`)}>
            <Icon name="edit" size={14} />
            Настройки
          </button>
        }
      />
      <div className="content">
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div className="card" style={{ overflow: 'hidden', background: '#000' }}>
            {status === 'error' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 480, gap: 12, color: 'var(--fg-subtle)' }}>
                <Icon name="camera" size={40} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: 14 }}>{errorMsg}</span>
                <button className="btn btn-sm" onClick={() => { setStatus('loading'); setErrorMsg('') }}>
                  Повторить
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {status === 'loading' && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 1 }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Подключение к камере…</div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  controls
                  muted
                  playsInline
                  style={{ width: '100%', display: 'block', aspectRatio: '16/9', background: '#000' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
