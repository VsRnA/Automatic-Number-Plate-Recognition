import { useEffect, useState } from 'react'

interface CamTileCamera {
  isEnabled: boolean
  name?: string
}

interface CamTileProps {
  camera: CamTileCamera
  snapshotUrl?: string | null
  small?: boolean
}

export function CamTile({ camera, snapshotUrl, small }: CamTileProps) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('ru-RU'))
  const live = camera.isEnabled

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setTime(new Date().toLocaleTimeString('ru-RU')), 1000)
    return () => clearInterval(id)
  }, [live])

  return (
    <div className="cam-tile" style={small ? { borderRadius: 4 } : undefined}>
      <div
        className={`cam-tile-feed ${live ? 'live' : ''}`}
        style={snapshotUrl ? {
          backgroundImage: `url(${snapshotUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      />
      {!snapshotUrl && !live && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          color: '#666', fontSize: 11, fontFamily: 'var(--font-mono)',
        }}>
          ОФФЛАЙН
        </div>
      )}
      <div className="cam-tile-overlay">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <span className={`cam-live-pill ${live ? '' : 'cam-live-off'}`}>
            {live ? 'LIVE' : 'OFF'}
          </span>
          {live && (
            <span className="cam-live-pill" style={{ fontFamily: 'var(--font-mono)' }}>
              25fps
            </span>
          )}
        </div>
        <div className="cam-tile-meta">
          {live && <span>{time}</span>}
        </div>
      </div>
    </div>
  )
}
