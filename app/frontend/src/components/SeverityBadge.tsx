import type { RiskSeverity } from '../types/api'
import { phantomDesign } from '../design-system/phantomDesign'

interface SeverityBadgeProps {
  readonly severity: RiskSeverity
}

export default function SeverityBadge({ severity }: SeverityBadgeProps): JSX.Element {
  const config = phantomDesign.severity[severity]

  return (
    <span
      className={`${phantomDesign.components.statusPill} ${config.badge}`}
      title={`${config.label} severity`}
    >
      {config.label}
    </span>
  )
}
