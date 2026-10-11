import { type CreateResult, type NamedVaultContext, type RefreshResult, refreshIndexes } from "#/services"
import type { Done } from "#/shared"

export async function maintainAddedMemory(
  vault: NamedVaultContext,
  folder: string,
  created: Extract<CreateResult, Done>,
): Promise<string[]> {
  const refreshed = await refreshIndexes(vault, folder)
  return [...maintenanceProblemsOf(created), ...maintenanceProblemsOf(refreshed)]
}

export function maintenanceProblemsOf(result: CreateResult | RefreshResult): string[] {
  if (!result.succeeded) {
    return result.problems.map((problem) => `${result.reason}: ${problem}`)
  }

  if (result.maintenanceProblems) {
    return result.maintenanceProblems
  }

  return []
}
