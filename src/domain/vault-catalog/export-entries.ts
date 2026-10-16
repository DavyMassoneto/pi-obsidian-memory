import type { VaultExportEntry, VaultExportFile } from "./types.ts"

export function exportEntries(
  global: readonly VaultExportFile[],
  project: readonly VaultExportFile[] | null,
): VaultExportEntry[] {
  const entries = global.map((file) => ({ path: `global/${file.path}`, bytes: file.bytes }))
  if (!project) return entries
  return [...entries, ...project.map((file) => ({ path: `project/${file.path}`, bytes: file.bytes }))]
}
