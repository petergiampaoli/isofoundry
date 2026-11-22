interface AxisBarProps {
  label: string;
  value: number;
  compact?: boolean;
}

export function AxisBar({ label, value, compact }: AxisBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={`axis ${compact ? 'axis--compact' : ''}`}>
      <span className="axis__label">{label}</span>
      <span className="axis__track">
        <span className="axis__fill" style={{ width: `${Math.round(clamped * 100)}%` }} />
      </span>
      {!compact && <span className="axis__value">{Math.round(clamped * 100)}</span>}
    </div>
  );
}
