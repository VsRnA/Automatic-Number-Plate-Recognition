import { useState, useRef, useEffect, useCallback } from 'react'
import { Toggle } from './Toggle'

export interface Point { x: number; y: number }

export interface ZoneConfig {
  points: Point[]
  minPlateRel: number   // fraction of frame height [0..1]
  maxPlateRel: number   // fraction of frame height [0..1]
  tilt: number
}

const REFERENCE_HEIGHT = 1080

const DEFAULT_CONFIG: ZoneConfig = {
  points: [
    { x: 0.18, y: 0.45 }, { x: 0.82, y: 0.45 },
    { x: 0.92, y: 0.85 }, { x: 0.08, y: 0.85 },
  ],
  minPlateRel: 80 / REFERENCE_HEIGHT,
  maxPlateRel: 280 / REFERENCE_HEIGHT,
  tilt: 15,
}

const PRESETS: Array<{ id: string; label: string; pts: Point[] }> = [
  { id: 'full', label: 'Весь кадр', pts: [{ x: 0.02, y: 0.02 }, { x: 0.98, y: 0.02 }, { x: 0.98, y: 0.98 }, { x: 0.02, y: 0.98 }] },
  { id: 'lane', label: 'Одна полоса', pts: [{ x: 0.30, y: 0.40 }, { x: 0.70, y: 0.40 }, { x: 0.85, y: 0.92 }, { x: 0.15, y: 0.92 }] },
  { id: 'near', label: 'Ближняя зона', pts: [{ x: 0.18, y: 0.55 }, { x: 0.82, y: 0.55 }, { x: 0.92, y: 0.92 }, { x: 0.08, y: 0.92 }] },
  { id: 'far', label: 'Дальняя зона', pts: [{ x: 0.30, y: 0.30 }, { x: 0.70, y: 0.30 }, { x: 0.78, y: 0.55 }, { x: 0.22, y: 0.55 }] },
]

interface ZoneEditorProps {
  isEnabled?: boolean
  snapshotUrl?: string | null
  snapshotLoading?: boolean
  defaultValue?: ZoneConfig
  onChange?: (cfg: ZoneConfig) => void
}

export function ZoneEditor({ isEnabled = true, snapshotUrl, snapshotLoading, defaultValue, onChange }: ZoneEditorProps) {
  const init = defaultValue ?? DEFAULT_CONFIG
  const [points, setPoints] = useState<Point[]>(init.points)
  const [minPlateRel, setMinPlateRel] = useState(init.minPlateRel)
  const [maxPlateRel, setMaxPlateRel] = useState(init.maxPlateRel)
  const [tilt, setTilt] = useState(init.tilt)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [hoverEdge, setHoverEdge] = useState<number | null>(null)
  const [showZone, setShowZone] = useState(true)
  const [refHeight, setRefHeight] = useState(REFERENCE_HEIGHT)
  const wrapRef = useRef<HTMLDivElement>(null)

  const toRel = (px: number) => px / refHeight
  const toPx = (rel: number) => Math.round(rel * refHeight)

  const emit = useCallback((p: Point[], mnRel: number, mxRel: number, t: number) => {
    onChange?.({ points: p, minPlateRel: mnRel, maxPlateRel: mxRel, tilt: t })
  }, [onChange])

  const updatePoints = (p: Point[]) => { setPoints(p); emit(p, minPlateRel, maxPlateRel, tilt) }
  const updateMinPlate = (px: number) => { const rel = toRel(px); setMinPlateRel(rel); emit(points, rel, maxPlateRel, tilt) }
  const updateMaxPlate = (px: number) => { const rel = toRel(px); setMaxPlateRel(rel); emit(points, minPlateRel, rel, tilt) }
  const updateTilt = (v: number) => { setTilt(v); emit(points, minPlateRel, maxPlateRel, v) }

  const onSnapshotLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const h = e.currentTarget.naturalHeight
    if (h > 0) setRefHeight(h)
  }

  const getPos = (e: MouseEvent | TouchEvent): Point => {
    const rect = wrapRef.current!.getBoundingClientRect()
    const touch = (e as TouchEvent).touches?.[0]
    const cx = (touch?.clientX ?? (e as MouseEvent).clientX) - rect.left
    const cy = (touch?.clientY ?? (e as MouseEvent).clientY) - rect.top
    return {
      x: Math.max(0, Math.min(1, cx / rect.width)),
      y: Math.max(0, Math.min(1, cy / rect.height)),
    }
  }

  useEffect(() => {
    if (dragIdx == null) return
    const onMove = (e: MouseEvent | TouchEvent) => {
      const p = getPos(e)
      setPoints(prev => {
        const next = prev.map((pt, i) => i === dragIdx ? p : pt)
        emit(next, minPlateRel, maxPlateRel, tilt)
        return next
      })
    }
    const onUp = () => setDragIdx(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragIdx, minPlateRel, maxPlateRel, tilt, emit])

  const insertPoint = (edgeIdx: number) => {
    const a = points[edgeIdx]
    const b = points[(edgeIdx + 1) % points.length]
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const next = [...points]
    next.splice(edgeIdx + 1, 0, mid)
    updatePoints(next)
  }

  const removePoint = (i: number) => {
    if (points.length <= 3) return
    updatePoints(points.filter((_, idx) => idx !== i))
  }

  const svgPolygon = points.map(p => `${p.x * 1000},${p.y * 562}`).join(' ')

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <div className="section-title">Область распознавания</div>
          <div className="text-xs text-subtle" style={{ marginTop: 2 }}>
            Полигон, в пределах которого ищутся номера. Меньше область — выше точность.
          </div>
        </div>
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Presets + toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="chip-row">
            {PRESETS.map(p => (
              <button key={p.id} className="chip" onClick={() => updatePoints(p.pts)}>{p.label}</button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="text-xs text-subtle">Показать зону</span>
            <Toggle on={showZone} onChange={setShowZone} />
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={wrapRef}
          style={{
            position: 'relative', borderRadius: 10, overflow: 'hidden',
            border: '1px solid var(--line)', aspectRatio: '16 / 9',
            touchAction: 'none', userSelect: 'none',
          }}
        >
          {/* Camera snapshot or placeholder */}
          {snapshotUrl ? (
            <img
              src={snapshotUrl}
              alt=""
              draggable={false}
              onLoad={onSnapshotLoad}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              background: isEnabled
                ? 'linear-gradient(135deg, #2a3138 0%, #14181d 100%)'
                : 'linear-gradient(135deg, #2a2a28 0%, #15161a 100%)',
            }}>
              {snapshotLoading && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'var(--font-mono)',
                }}>
                  Загрузка кадра…
                </div>
              )}
            </div>
          )}

          {showZone && (
            <svg
              viewBox="0 0 1000 562"
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              <defs>
                <mask id="zoneMask">
                  <rect width="1000" height="562" fill="white" />
                  <polygon points={svgPolygon} fill="black" />
                </mask>
              </defs>
              <rect width="1000" height="562" fill="rgba(0,0,0,0.55)" mask="url(#zoneMask)" />
              <polygon
                points={svgPolygon}
                fill="rgba(91,140,255,0.18)"
                stroke="rgba(120,170,255,0.95)"
                strokeWidth="2"
              />
            </svg>
          )}

          {/* Edge midpoints (add node) */}
          {showZone && points.map((p, i) => {
            const next = points[(i + 1) % points.length]
            const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 }
            return (
              <button
                key={`edge-${i}`}
                onMouseEnter={() => setHoverEdge(i)}
                onMouseLeave={() => setHoverEdge(null)}
                onClick={() => insertPoint(i)}
                title="Добавить точку"
                style={{
                  position: 'absolute',
                  left: `${mid.x * 100}%`, top: `${mid.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 18, height: 18, borderRadius: '50%',
                  background: hoverEdge === i ? 'rgba(120,170,255,0.9)' : 'rgba(120,170,255,0.4)',
                  border: '1.5px solid white',
                  padding: 0, cursor: 'copy',
                  display: 'grid', placeItems: 'center',
                  color: 'white', fontSize: 14, fontWeight: 600,
                  opacity: hoverEdge === i ? 1 : 0.6,
                  transition: 'opacity 0.12s, background 0.12s',
                }}
              >+</button>
            )
          })}

          {/* Drag handles */}
          {showZone && points.map((p, i) => (
            <div
              key={`pt-${i}`}
              onMouseDown={e => { e.preventDefault(); setDragIdx(i) }}
              onTouchStart={e => { e.preventDefault(); setDragIdx(i) }}
              onDoubleClick={() => removePoint(i)}
              title="Перетащите. Двойной клик — удалить"
              style={{
                position: 'absolute',
                left: `${p.x * 100}%`, top: `${p.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 22, height: 22, borderRadius: '50%',
                background: 'white',
                border: '3px solid oklch(0.55 0.13 252)',
                cursor: dragIdx === i ? 'grabbing' : 'grab',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                zIndex: 2,
              }}
            />
          ))}

          <div style={{ position: 'absolute', right: 12, bottom: 12, fontSize: 10.5, color: 'rgba(255,255,255,0.75)', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', padding: '4px 8px', borderRadius: 4 }}>
            Перетащите узлы · «+» — добавить · двойной клик — удалить
          </div>
        </div>

        {/* Sliders */}
        <div className="field-row cols-3">
          <div className="field">
            <label>Мин. высота номера, px <span className="font-mono text-subtle">{toPx(minPlateRel)}</span></label>
            <input type="range" min="40" max="200" value={toPx(minPlateRel)} onChange={e => updateMinPlate(Number(e.target.value))} style={{ width: '100%' }} />
            <div className="field-help">Меньше — пропускаем мелочь</div>
          </div>
          <div className="field">
            <label>Макс. высота номера, px <span className="font-mono text-subtle">{toPx(maxPlateRel)}</span></label>
            <input type="range" min="120" max="500" value={toPx(maxPlateRel)} onChange={e => updateMaxPlate(Number(e.target.value))} style={{ width: '100%' }} />
            <div className="field-help">Защита от ложных срабатываний</div>
          </div>
          <div className="field">
            <label>Допустимый наклон, ° <span className="font-mono text-subtle">±{tilt}</span></label>
            <input type="range" min="0" max="45" value={tilt} onChange={e => updateTilt(Number(e.target.value))} style={{ width: '100%' }} />
            <div className="field-help">Угол поворота номера в кадре</div>
          </div>
        </div>
      </div>
    </div>
  )
}
