import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
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
  streamUrl: string
  size: 'thumbnail' | 'full'
}

export function VideoStream({ streamUrl, size }: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!HLS_SUPPORTED || !streamUrl) return

    const video = videoRef.current
    if (!video) return

    setError(false)
    let hls: Hls | null = null

    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true })
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError(true)
      })
    } else {
      video.src = streamUrl
      video.onerror = () => setError(true)
    }

    return () => {
      hls?.destroy()
      video.src = ''
      video.onerror = null
    }
  }, [streamUrl])

  const wrapperClass = `${styles.wrapper} ${styles[size]}`

  if (!HLS_SUPPORTED || !streamUrl) {
    return (
      <div className={wrapperClass}>
        <div className={styles.placeholder}>
          <span className={styles.placeholderIcon}>
            <CameraIcon size={size === 'thumbnail' ? 18 : 32} />
          </span>
          <span className={styles.placeholderText}>Поток недоступен</span>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      {error ? (
        <div className={styles.placeholder}>
          <div className={styles.errorOverlay}>
            <AlertIcon />
            <span>Ошибка потока</span>
          </div>
        </div>
      ) : (
        <>
          <video ref={videoRef} className={styles.video} autoPlay muted playsInline />
          <div className={styles.liveBadge}>
            <span className={styles.liveDot} />
            LIVE
          </div>
        </>
      )}
    </div>
  )
}
