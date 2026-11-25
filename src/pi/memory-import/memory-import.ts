import { join } from "node:path"

import type { CompletionFactory } from "#src/pi/completion"
import {
  type MemoryCommand,
  type MemoryPaths,
  type MemoryPiContext,
  STATUS_IMPORTING,
  withMemoryStatus,
} from "#src/pi/context"
import { type MemorySessionKeeper, NO_SESSION_NOTICE } from "#src/pi/memory-session"
import {
  type ImportReport,
  importOmMemory,
  type MemoryOperationContext,
  type OmImportPlan,
  prepareOmImport,
} from "#src/usecases"
import {
  IMPORT_DONE,
  IMPORT_NO_FILES,
  IMPORT_SETUP_HINT,
  IMPORT_STOPPED,
  MEMORY_IMPORT_DESCRIPTION,
  OM_FOLDER_LABEL,
} from "./constants.ts"
import type { ImportFailure } from "./types.ts"

export function memoryImportCommand(
  paths: MemoryPaths,
  sessions: MemorySessionKeeper,
  completionOf: CompletionFactory,
): MemoryCommand {
  return {
    description: MEMORY_IMPORT_DESCRIPTION,
    async handler(_args, ctx) {
      if (!ctx.hasUI) return
      const operation = sessions.cycleOperation(ctx, paths)
      if (!operation) return ctx.ui.notify(NO_SESSION_NOTICE, "error")
      await runMemoryImport(ctx, operation, completionOf)
    },
  }
}

async function runMemoryImport(
  ctx: MemoryPiContext,
  operation: MemoryOperationContext,
  completionOf: CompletionFactory,
): Promise<void> {
  const prepared = await prepareOmImport(operation)
  if (!prepared.succeeded) return ctx.ui.notify(describeRefusal(prepared), "error")
  const plan = prepared.output
  if (plan.files.length === 0) return ctx.ui.notify(`${IMPORT_NO_FILES} ${omFolderOf(plan)}.`, "info")
  const imported = await withMemoryStatus(ctx, STATUS_IMPORTING, () =>
    importOmMemory(plan, operation, completionOf(ctx)),
  )
  if (!imported.succeeded) return ctx.ui.notify(describeRefusal(imported), "error")
  const { stoppedBy } = imported.output
  const done = describeImported(plan, imported.output)
  if (typeof stoppedBy === "string") return ctx.ui.notify(`${done} ${IMPORT_STOPPED} ${stoppedBy}`, "warning")
  ctx.ui.notify(done, "info")
}

function omFolderOf(plan: OmImportPlan): string {
  return join(plan.folder, OM_FOLDER_LABEL)
}

function describeImported(plan: OmImportPlan, report: ImportReport): string {
  const changes = report.applied.filter((write) => write.status === "applied").length
  return `${IMPORT_DONE} ${report.files} file(s) from ${omFolderOf(plan)}: ${changes} change(s) to the vaults.`
}

function describeRefusal(result: ImportFailure): string {
  const lines = [...result.problems]
  if (result.reason === "not-configured" || result.reason === "invalid-config") lines.push(IMPORT_SETUP_HINT)
  return lines.join("\n")
}
