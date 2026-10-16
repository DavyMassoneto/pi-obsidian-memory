import type { MaintenanceWarnings, RefreshResult } from "#src/services"

export function refreshWarnings(refreshed: RefreshResult): string[] {
  if (!refreshed.succeeded) return refreshed.problems.map((problem) => `${refreshed.reason}: ${problem}`)
  return warningsOf(refreshed)
}

export function warningsOf(result: MaintenanceWarnings): string[] {
  if (result.maintenanceProblems) return [...result.maintenanceProblems]
  return []
}
