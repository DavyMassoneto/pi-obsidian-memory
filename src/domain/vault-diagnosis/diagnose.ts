import { catalogFolder } from "#src/domain/search-catalog"
import { isRootArchive, type VaultCatalogEntry } from "#src/domain/vault-catalog"
import type {
  CrowdedFolder,
  DuplicateNoteId,
  InvalidVaultNote,
  VaultDiagnosis,
  VaultDiagnosisRequest,
} from "./types.ts"

export function diagnoseVault(request: VaultDiagnosisRequest): VaultDiagnosis {
  return {
    invalid: invalidNotes(request),
    blank: request.inspected
      .filter((file) => file.analysis.status === "unclosed")
      .map((file) => file.path)
      .sort(compareText),
    duplicateIds: duplicateIds(request),
    temporaries: request.entries
      .filter((entry) => entry.kind === "temporary")
      .map((entry) => entry.path)
      .sort(compareText),
    crowdedFolders: crowdedFolders(request),
  }
}

function invalidNotes(request: VaultDiagnosisRequest): InvalidVaultNote[] {
  const invalid: InvalidVaultNote[] = []
  for (const file of request.inspected) {
    const { analysis } = file
    if (analysis.status === "parsed" && analysis.needsFixing) {
      invalid.push({
        path: file.path,
        problems: [...analysis.frontmatterProblems, ...analysis.nameProblems, ...analysis.bodyProblems],
      })
    }
  }
  return invalid.sort((left, right) => compareText(left.path, right.path))
}

function duplicateIds(request: VaultDiagnosisRequest): DuplicateNoteId[] {
  const groups = new Map<string, string[]>()
  for (const file of request.inspected) {
    const { analysis } = file
    if (analysis.status !== "parsed" || !analysis.frontmatter) continue
    const group = groups.get(analysis.frontmatter.id)
    if (group) group.push(file.path)
    else groups.set(analysis.frontmatter.id, [file.path])
  }
  return [...groups]
    .filter(([, paths]) => paths.length > 1)
    .map(([id, paths]) => ({ id, paths: paths.sort(compareText) }))
    .sort((left, right) => compareText(left.id, right.id))
}

function crowdedFolders(request: VaultDiagnosisRequest): CrowdedFolder[] {
  const counts = new Map<string, number>()
  for (const entry of request.entries) {
    if (!isLiveNote(entry)) continue
    const folder = catalogFolder(entry.path)
    const count = counts.get(folder)
    if (count) counts.set(folder, count + 1)
    else counts.set(folder, 1)
  }
  return [...counts]
    .filter(([, count]) => count > request.limits.maxNotesPerFolder)
    .map(([folder, count]) => ({ folder, count }))
    .sort((left, right) => compareText(left.folder, right.folder))
}

function isLiveNote(entry: VaultCatalogEntry): boolean {
  return entry.kind === "note" && !entry.archived && !isRootArchive(entry.path)
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
