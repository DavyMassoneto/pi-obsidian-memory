import type { CompletionPort } from "#src/services"
import { captureMemory } from "#src/usecases/capture-memory"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"
import { STOPPED_PROBLEMS_SEPARATOR } from "./constants.ts"
import type { ImportOmMemoryResult, ImportReport, ImportRun, OmImportPlan, PlannedFile } from "./types.ts"

export async function importOmMemory(
  plan: OmImportPlan,
  context: MemoryOperationContext,
  complete: CompletionPort,
): Promise<ImportOmMemoryResult> {
  const report: ImportReport = { files: 0, parts: 0, applied: [], stoppedBy: null }
  for (const file of plan.files) {
    const refusal = await importFile(file, { plan, context, complete, report })
    if (refusal) return refusal
    if (typeof report.stoppedBy === "string") break
    report.files += 1
  }
  return { succeeded: true, output: report }
}

async function importFile(file: PlannedFile, run: ImportRun): Promise<MemoryResolutionRefusal | null> {
  const { plan, context, complete, report } = run
  for (const [index, text] of file.parts.entries()) {
    const label = `${file.path} (part ${index + 1} of ${file.parts.length})`
    const captured = await captureMemory(
      { kind: "import", material: [{ label, text }], model: plan.model, thinking: plan.thinking, explicitSaves: [] },
      context,
      complete,
    )
    if (captured.succeeded) {
      report.applied.push(...captured.output.applied)
      report.parts += 1
    } else if ("report" in captured) {
      report.applied.push(...captured.report.applied)
      report.stoppedBy = captured.problems.join(STOPPED_PROBLEMS_SEPARATOR)
      return null
    } else {
      return captured
    }
  }
  return null
}
