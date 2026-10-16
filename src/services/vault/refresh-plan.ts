import { relative, sep } from "node:path"

import { ancestorFolders } from "#/domain"
import { linkStatOf } from "#/services/vault/filesystem"
import type { Succeeded } from "#/shared"
import { resolveFolder } from "./resolve.ts"
import type { RefreshPlan, RefreshRefusal, ResolveRefusal } from "./types.ts"

export async function planRefreshFolders(
  vault: string,
  folders: string[],
): Promise<Succeeded<RefreshPlan> | RefreshRefusal> {
  try {
    return await planFolders(vault, folders)
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    return maintenanceFailure(error)
  }
}

async function planFolders(vault: string, folders: string[]): Promise<Succeeded<RefreshPlan> | ResolveRefusal> {
  const root = await resolveFolder(vault, "")
  if (!root.succeeded) {
    return root
  }

  const discoveredFolders = new Set(folders)
  const ancestors = new Set<string>()
  const refusals: RefreshRefusal[] = []
  for (const folder of discoveredFolders) {
    const checked = await resolveFolder(vault, folder)
    if (!checked.succeeded) {
      refusals.push(checked)
      continue
    }

    const existing = await linkStatOf(checked.output)
    if (!existing.succeeded) {
      refusals.push(existing)
      continue
    }

    const physical = relative(root.output, checked.output).split(sep).join("/")
    for (const ancestor of [...ancestorFolders(physical), ...ancestorFolders(folder)]) {
      ancestors.add(ancestor)
      discoveredFolders.add(ancestor)
    }
  }

  return { succeeded: true, output: { folders: ancestors, refusals } }
}

export function maintenanceFailure(error: Error): RefreshRefusal {
  if (
    !("code" in error) ||
    typeof error.code !== "string" ||
    !("syscall" in error) ||
    typeof error.syscall !== "string" ||
    !("errno" in error) ||
    typeof error.errno !== "number" ||
    !Number.isFinite(error.errno)
  ) {
    throw error
  }

  return { succeeded: false, reason: "io-error", problems: [error.message] }
}
