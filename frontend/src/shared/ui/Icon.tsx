interface IconProps {
  name: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 16, className, style }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24' as const,
    fill: 'none' as const,
    stroke: 'currentColor' as const,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
    'aria-hidden': true as const,
  }

  const icons: Record<string, React.ReactNode> = {
    camera: <><path d="M3 7h3l2-2h8l2 2h3v12H3z" /><circle cx="12" cy="13" r="3.5" /></>,
    plate: <><rect x="3" y="7" width="18" height="10" rx="1.5" /><path d="M7 11h2M11 11h2M15 11h2M7 13.5h10" /></>,
    gate: <><path d="M3 21V8m18 13V8M3 8l9-4 9 4M7 21V12h10v9M11 21v-5h2v5" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 8v4l3 2" /></>,
    key: <><circle cx="8" cy="14" r="4" /><path d="m11 11 8-8m-3 3 2 2m1-5 2 2" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5-5 5 5M12 5v12" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></>,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></>,
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    check: <><path d="m20 6-11 11-5-5" /></>,
    chevR: <><path d="m9 6 6 6-6 6" /></>,
    chevL: <><path d="m15 6-6 6 6 6" /></>,
    chevD: <><path d="m6 9 6 6 6-6" /></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
    arrowIn: <><path d="M21 12H9M9 12l4-4M9 12l4 4M5 4v16" /></>,
    arrowOut: <><path d="M3 12h12M15 12l-4-4M15 12l-4 4M19 4v16" /></>,
    arrowBoth: <><path d="M21 12H3M21 12l-4-4M21 12l-4 4M3 12l4-4M3 12l4 4" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    filter: <><path d="M22 3H2l8 9.5V19l4 2v-8.5z" /></>,
    analytics: <><path d="M3 3v18h18" /><path d="M7 16l4-4 4 4 4-8" /></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    play: <><polygon points="5 3 19 12 5 21 5 3" /></>,
    refresh: <><path d="M1 4v6h6" /><path d="M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></>,
  }

  const content = icons[name] ?? <></>

  return <svg {...common}>{content}</svg>
}
