import { relative, sep } from "node:path"

import { ancestorFolders } from "#src/domain"
import { linkStatOf } from "#src/services/vault/filesystem"
import type { Succeeded } from "#src/shared"
import { resolveFolder } from "./resolve.ts"
import type { RefreshPlan, RefreshRefusal, RefreshScope, ResolveRefusal } from "./types.ts"

export async function planRefreshFolders(
  vault: string,
  folders: string[],
  scope: RefreshScope,
): Promise<Succeeded<RefreshPlan> | RefreshRefusal> {
  try {
    return await planFolders(vault, folders, scope)
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    return maintenanceFailure(error)
  }
}

async function planFolders(
  vault: string,
  folders: string[],
  scope: RefreshScope,
): Promise<Succeeded<RefreshPlan> | ResolveRefusal> {
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
    let selected = [folder]
    if (scope === "with-ancestors") {
      selected = [...ancestorFolders(physical), ...ancestorFolders(folder)]
    }
    for (const chosen of selected) {
      ancestors.add(chosen)
      discoveredFolders.add(chosen)
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
