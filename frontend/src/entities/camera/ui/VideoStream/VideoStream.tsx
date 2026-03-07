import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import type { StreamStatus } from '../../model/types'
import { cameraApi } from '../../api/cameraApi'
import styles from './VideoStream.module.css'

const HLS_SUPPORTED =
  typeof window !== 'undefined' &&
  (Hls.isSupported() ||
    document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '')


function CameraIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.73)} viewBox="0 0 22 16" fill="none">
      <rect x="1" y="2" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 6L21 3V13L14 10V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
    </svg>
  )
}

interface VideoStreamProps {
  cameraId: string
  size: 'thumbnail' | 'full'
  autoStart?: boolean
}

export function VideoStream({ cameraId, size, autoStart }: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [status, setStatus] = useState<StreamStatus>(HLS_SUPPORTED ? 'loading' : 'error')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!HLS_SUPPORTED) return
    let cancelled = false
    cameraApi.stream.status(cameraId).then(res => {
      if (!cancelled) {
        if (res.status === 'idle' && autoStart) {
          cameraApi.stream.start(cameraId)
            .then(() => setStatus('running'))
            .catch(() => setStatus('error'))
        } else {
          setStatus(res.status)
        }
      }
    }).catch(() => {
      if (!cancelled) setStatus('idle')
    })
    return () => { cancelled = true }
  }, [cameraId, autoStart])

  useEffect(() => {
    if (status !== 'running') return

    const video = videoRef.current
    if (!video) return

    let hls: Hls | null = null
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true })
      hls.loadSource(cameraApi.stream.hlsUrl(cameraId))
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setStatus('error')
      })
    } else {
      video.src = cameraApi.stream.hlsUrl(cameraId)
      video.onerror = () => setStatus('error')
    }

    return () => {
      hls?.destroy()
      video.src = ''
      video.onerror = null
    }
  }, [status, cameraId])

  const handleStart = () => {
    setActionLoading(true)
    cameraApi.stream.start(cameraId)
      .then(() => setStatus('running'))
      .catch(() => setStatus('error'))
      .finally(() => setActionLoading(false))
  }

  const handleStop = () => {
    setActionLoading(true)
    cameraApi.stream.stop(cameraId)
      .then(() => setStatus('idle'))
      .catch(() => {})
      .finally(() => setActionLoading(false))
  }

  const wrapperClass = `${styles.wrapper} ${styles[size]}`

  return (
    <div>
      <div className={wrapperClass}>
        {(status === 'idle' || status === 'loading') && (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>
              <CameraIcon size={size === 'thumbnail' ? 18 : 32} />
            </span>
            <span className={styles.placeholderText}>
              {status === 'loading' ? 'Загрузка...' : 'Поток не запущен'}
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.placeholder}>
            <div className={styles.errorOverlay}>
              <AlertIcon />
              <span>Ошибка потока</span>
            </div>
          </div>
        )}

        {status === 'running' && (
          <>
            <video ref={videoRef} className={styles.video} autoPlay muted playsInline />
            <div className={styles.liveBadge}>
              <span className={styles.liveDot} />
              LIVE
            </div>
          </>
        )}
      </div>

      {size === 'full' && (
        <div className={styles.controls}>
          {status !== 'running' ? (
            <button
              className={styles.btnStart}
              onClick={handleStart}
              disabled={actionLoading || status === 'loading'}
            >
              {actionLoading ? 'Запуск...' : 'Запустить поток'}
            </button>
          ) : (
            <button
              className={styles.btnStop}
              onClick={handleStop}
              disabled={actionLoading}
            >
              {actionLoading ? 'Остановка...' : 'Остановить поток'}
            </button>
          )}
          {status === 'error' && (
            <span className={styles.statusText}>Не удалось подключиться к потоку</span>
          )}
        </div>
      )}
    </div>
  )
}
