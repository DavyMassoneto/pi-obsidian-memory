import type { CreateResult, RefreshResult } from "#/services"

export function maintenanceProblemsOf(result: CreateResult | RefreshResult): string[] {
  if (!result.succeeded) {
    return result.problems.map((problem) => `${result.reason}: ${problem}`)
  }

  if (result.maintenanceProblems) {
    return result.maintenanceProblems
  }

  return []
}
