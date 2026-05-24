import { useState } from 'react'
import { api } from '@/shared/api'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useDashboard } from '@/entities/analytics'
import { formatDateTime } from '@/shared/lib'
import { PlateBadge } from '@/shared/ui'
import type { DashboardData } from '@/entities/analytics'

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  delta,
  hint,
  accent,
}: {
  label: string
  value: number | string
  delta?: number | null
  hint?: string
  accent?: boolean
}) {
  const deltaClass = delta == null ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const deltaSymbol = delta == null ? null : delta > 0 ? '▲' : delta < 0 ? '▼' : '—'

  return (
    <div
      className="kpi"
      style={accent ? { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent)' } : undefined}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accent ? { color: 'var(--accent)' } : undefined}>
        {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
      </div>
      <div className="kpi-meta">
        {delta != null && (
          <span className={`kpi-delta ${deltaClass}`}>
            {deltaSymbol} {Math.abs(delta)}%
          </span>
        )}
        {hint && <span className="kpi-hint">{hint}</span>}
      </div>
    </div>
  )
}

// ─── Custom SVG Donut ────────────────────────────────────────────────────────

function DonutChart({ granted, denied }: { granted: number; denied: number }) {
  const total = granted + denied
  if (total === 0) return <div className="empty" style={{ padding: '32px 0' }}>Нет данных</div>

  const grantedPct = granted / total
  const R = 64, r = 42
  const C = 2 * Math.PI * R
  const grantedArc = C * grantedPct

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '8px 0' }}>
      <div style={{ position: 'relative', width: 148, height: 148, flexShrink: 0 }}>
        <svg viewBox="-80 -80 160 160" width="148" height="148" style={{ transform: 'rotate(-90deg)' }}>
          <circle r={R} fill="none" stroke="var(--danger)" strokeOpacity="0.85" strokeWidth={R - r} />
          <circle
            r={R}
            fill="none"
            stroke="var(--success)"
            strokeWidth={R - r}
            strokeDasharray={`${grantedArc} ${C}`}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {Math.round(grantedPct * 100)}%
            </div>
            <div className="text-xs text-subtle">разрешений</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--success)' }} />
          <span className="legend-label">Разрешено</span>
          <span className="legend-val">{granted.toLocaleString('ru-RU')}</span>
          <span className="legend-pct">{Math.round(grantedPct * 100)}%</span>
        </div>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--danger)' }} />
          <span className="legend-label">Отказано</span>
          <span className="legend-val">{denied.toLocaleString('ru-RU')}</span>
          <span className="legend-pct">{Math.round((1 - grantedPct) * 100)}%</span>
        </div>
        <div style={{
          paddingTop: 8,
          borderTop: '1px dashed var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
        }}>
          <span className="text-subtle">Всего за период</span>
          <span className="mono">{total.toLocaleString('ru-RU')}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Horizontal Bar Chart (By Camera) ────────────────────────────────────────

function ByCameraBars({ data }: { data: DashboardData['byCamera'] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.cameraId} className="bar-row">
          <div className="bar-label" title={d.cameraName}>{d.cameraName}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <div className="bar-val">{d.count.toLocaleString('ru-RU')}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Top Plates Table ─────────────────────────────────────────────────────────

function TopPlatesTable({ data }: { data: DashboardData['topPlates'] }) {
  return (
    <table className="tbl-flush">
      <thead>
        <tr>
          <th>Номер</th>
          <th style={{ textAlign: 'right' }}>Проездов</th>
          <th>Разрешений</th>
          <th>Последний визит</th>
        </tr>
      </thead>
      <tbody>
        {data.map(p => {
          const grantRate = p.count > 0 ? p.grantedCount / p.count : 0
          return (
            <tr key={p.plateNumber}>
              <td><PlateBadge number={p.plateNumber} /></td>
              <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>
                {p.count.toLocaleString('ru-RU')}
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 64, height: 4,
                    background: 'var(--bg-sunken)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${grantRate * 100}%`,
                      height: '100%',
                      background: grantRate > 0.5 ? 'var(--success)' : 'var(--danger)',
                      borderRadius: 2,
                    }} />
                  </div>
                  <span className="mono text-xs" style={{ width: 36, color: 'var(--fg-muted)' }}>
                    {Math.round(grantRate * 100)}%
                  </span>
                </div>
              </td>
              <td className="text-sm text-subtle">{formatDateTime(p.lastSeen)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Area Chart Tooltip ───────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const d = new Date(label)
  const fmt = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
  return (
    <div className="chart-tooltip" style={{ position: 'static', transform: 'none', minWidth: 130 }}>
      <div className="chart-tooltip-date">{fmt}</div>
      <div className="chart-tooltip-row">
        <span>Распознано</span>
        <span className="mono">{payload[0].value.toLocaleString('ru-RU')}</span>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 40, w = '100%' }: { h?: number; w?: number | string }) {
  return (
    <div style={{
      height: h, width: w,
      borderRadius: 'var(--radius)',
      background: 'var(--bg-sunken)',
      animation: 'skeletonPulse 1.6s ease-in-out infinite',
    }} />
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function AnalyticsCard({
  title,
  sub,
  action,
  wide,
  children,
  noPad,
}: {
  title: string
  sub?: string
  action?: React.ReactNode
  wide?: boolean
  children: React.ReactNode
  noPad?: boolean
}) {
  return (
    <div className={`card${wide ? ' analytics-card-wide' : ''}`}>
      <div className="section-header">
        <div>
          <div className="section-title">{title}</div>
          {sub && <div className="text-xs text-subtle" style={{ marginTop: 2 }}>{sub}</div>}
        </div>
        {action}
      </div>
      {noPad ? children : <div style={{ padding: '8px 18px 18px' }}>{children}</div>}
    </div>
  )
}

// ─── Download icon ────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PERIODS = [
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: '90d', label: '90 дней' },
] as const

type Period = (typeof PERIODS)[number]['id']

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [exporting, setExporting] = useState(false)
  const { data, isLoading, isError, dataUpdatedAt } = useDashboard(period)

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await api.getBlob('/recognition/export/excel')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'recognition_history.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }
  const refreshTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <>
      <div className="topbar">
        <div>
          <div className="crumbs">Основное</div>
          <h1>Аналитика</h1>
        </div>
        <div className="topbar-actions">
          <div className="chip-row">
            {PERIODS.map(p => (
              <button
                key={p.id}
                className={`chip${period === p.id ? ' active' : ''}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="btn" onClick={handleExport} disabled={exporting}>
            <DownloadIcon />
            {exporting ? 'Экспорт…' : 'Экспорт'}
          </button>
        </div>
      </div>

      <div className="content">
        {/* KPI grid */}
        <div className="kpi-grid">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={100} />)
          ) : isError ? (
            <div className="text-subtle" style={{ gridColumn: '1/-1' }}>Не удалось загрузить данные</div>
          ) : data ? (
            <>
              <KpiCard label="Сегодня" value={data.summary.today} hint="к среднему за неделю" accent />
              <KpiCard label="Неделя" value={data.summary.thisWeek} hint="к прошлой неделе" />
              <KpiCard label="Месяц" value={data.summary.thisMonth} hint="к прошлому месяцу" />
              <KpiCard label="Всего распознано" value={data.summary.total} hint="за всё время" />
              <KpiCard label="Уникальных номеров" value={data.summary.uniquePlates} hint="в базе системы" />
            </>
          ) : null}
        </div>

        {/* Analytics grid */}
        <div className="analytics-grid">

          {/* Area chart — wide */}
          {isLoading ? (
            <Skeleton h={280} />
          ) : data && data.timeline.length > 0 ? (
            <AnalyticsCard
              title="Распознавания по дням"
              sub={`Последние ${period === '7d' ? '7' : period === '30d' ? '30' : '90'} дней`}
              action={refreshTime ? (
                <span className="text-xs text-subtle">Обновлено {refreshTime}</span>
              ) : undefined}
              wide
            >
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.timeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 3" stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={d => {
                      const date = new Date(d)
                      return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`
                    }}
                    tick={{ fontSize: 10.5, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10.5, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    fill="url(#areaFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--bg-elev)', stroke: 'var(--accent)', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </AnalyticsCard>
          ) : null}

          {/* Donut — narrow */}
          {isLoading ? (
            <Skeleton h={280} />
          ) : data ? (
            <AnalyticsCard title="Доступ" sub="Разрешено vs отказано">
              <DonutChart granted={data.summary.granted} denied={data.summary.denied} />
            </AnalyticsCard>
          ) : null}

          {/* Top plates table — wide */}
          {isLoading ? (
            <Skeleton h={300} />
          ) : data && data.topPlates.length > 0 ? (
            <AnalyticsCard
              title="Топ-номера по числу проездов"
              sub={`${data.topPlates.length} наиболее активных за период`}
              wide
              noPad
            >
              <TopPlatesTable data={data.topPlates} />
            </AnalyticsCard>
          ) : null}

          {/* By-camera horizontal bars — narrow */}
          {isLoading ? (
            <Skeleton h={220} />
          ) : data && data.byCamera.length > 0 ? (
            <AnalyticsCard title="По камерам" sub="Распределение нагрузки">
              <ByCameraBars data={data.byCamera} />
            </AnalyticsCard>
          ) : null}

        </div>

        {/* Empty state */}
        {!isLoading && !isError && data && data.summary.total === 0 && (
          <div className="empty">
            <h3>Нет данных для анализа</h3>
            <p>Данные появятся после первых распознаваний</p>
          </div>
        )}

      </div>

      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  )
}
