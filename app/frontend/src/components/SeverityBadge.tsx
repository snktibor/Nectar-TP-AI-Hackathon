import type { RiskSeverity } from '../types/api'

interface SeverityBadgeProps {
  severity: RiskSeverity
}

const severityStyles: Record<RiskSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-red-100 text-red-600',
  MEDIUM: 'bg-orange-100 text-orange-700',
  LOW: 'bg-yellow-100 text-yellow-700',
}

export default function SeverityBadge({ severity }: SeverityBadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${severityStyles[severity]}`}
    >
      {severity}
    </span>
  )
}
