import { importParts, readOmMemory, resolveProject } from "#src/services"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { resolveMemory } from "#src/usecases/resolve-memory"
import { NO_PROJECT_TO_IMPORT_INTO } from "./constants.ts"
import type { PlannedFile, PrepareOmImportResult } from "./types.ts"

export async function prepareOmImport(context: MemoryOperationContext): Promise<PrepareOmImportResult> {
  const resolved = await resolveMemory(context)
  if (!resolved.succeeded) return resolved
  const { config, workingFolder, platform } = resolved.output
  const project = resolveProject(config, workingFolder, platform)
  if (!project.succeeded) {
    return { succeeded: false, reason: "no-project", workingFolder, problems: [NO_PROJECT_TO_IMPORT_INTO] }
  }
  const sources = await readOmMemory(project.output.folder)
  if (!sources.succeeded) return sources
  const files: PlannedFile[] = []
  for (const source of sources.output) {
    const parts = importParts(source.text, config.observer.chunkTokens)
    if (parts.length > 0) files.push({ path: source.path, parts })
  }
  const { model, thinking } = config.consolidator
  return { succeeded: true, output: { folder: project.output.folder, files, model, thinking } }
}
