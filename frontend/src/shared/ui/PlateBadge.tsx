interface PlateBadgeProps {
  number: string
  region?: string
}

export function PlateBadge({ number, region }: PlateBadgeProps) {
  return (
    <span className="plate">
      <span className="plate-num">{number}</span>
      {region && (
        <span className="plate-region">
          {region}
          <span style={{ fontSize: '8px', marginLeft: '2px', letterSpacing: 0 }}>RUS</span>
        </span>
      )}
    </span>
  )
}
