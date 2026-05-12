import type {
  BackendBenchmarkRisk,
  BackendConsistencyError,
  BackendMissingElement,
} from '../lib/backendAudit'

export type AnyFinding =
  | { kind: 'consistency'; finding: BackendConsistencyError }
  | { kind: 'benchmark'; finding: BackendBenchmarkRisk }
  | { kind: 'missing'; finding: BackendMissingElement }
