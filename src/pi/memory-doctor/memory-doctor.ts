import type { MemoryCommand, MemoryPaths, MemoryPiContext } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import {
  BLANK_NOTE_TYPES,
  type BlankFile,
  completeBlankMemory,
  type DiagnosedMemory,
  diagnoseMemory,
  type MemoryOperationContext,
  type VaultReport,
} from "#src/usecases"
import {
  COMPLETE_BODY_TITLE,
  COMPLETE_CONFIRM_MESSAGE,
  COMPLETE_SKIPPED,
  COMPLETE_TYPE_TITLE,
  COMPLETED,
  DOCTOR_SETUP_HINT,
  MEMORY_DOCTOR_DESCRIPTION,
} from "./constants.ts"
import { renderDoctorReport } from "./report.ts"
import type { BlankTarget, DoctorModelPort } from "./types.ts"

export function memoryDoctorCommand(paths: MemoryPaths, sessions: MemorySessionKeeper): MemoryCommand {
  return {
    description: MEMORY_DOCTOR_DESCRIPTION,
    async handler(_args, ctx) {
      if (!ctx.hasUI) return
      const { registration } = sessions.registrationFlow(ctx, paths)
      await runMemoryDoctor(ctx, registration)
    },
  }
}

async function runMemoryDoctor(ctx: MemoryPiContext, context: MemoryOperationContext): Promise<void> {
  const port: DoctorModelPort = {
    find: (provider, id) => ctx.modelRegistry.find(provider, id),
    auth: (model) => ctx.modelRegistry.getApiKeyAndHeaders(model),
  }
  const diagnosed = await diagnoseMemory({ port }, context)
  if (!diagnosed.succeeded) {
    return ctx.ui.notify([...diagnosed.problems, DOCTOR_SETUP_HINT].join("\n"), "error")
  }
  ctx.ui.notify(renderDoctorReport(diagnosed.output), levelOf(diagnosed.output))
  for (const target of blankTargets(diagnosed.output)) await offerCompletion(ctx, context, target)
}

function levelOf(diagnosed: DiagnosedMemory): "info" | "warning" {
  for (const report of diagnosed.vaults) {
    if ("problems" in report) return "warning"
    const { diagnosis } = report
    const found = [
      diagnosis.invalid,
      diagnosis.duplicateIds,
      diagnosis.blank,
      diagnosis.temporaries,
      diagnosis.crowdedFolders,
    ]
    if (found.some((items) => items.length > 0) || report.unreadable.length > 0) return "warning"
  }
  if (diagnosed.models.some((report) => report.check.status !== "ok")) return "warning"
  return "info"
}

function blankTargets(diagnosed: DiagnosedMemory): BlankTarget[] {
  const reports = diagnosed.vaults.filter((report): report is VaultReport => "blanks" in report)
  return reports.flatMap((report) => report.blanks.map((blank: BlankFile) => ({ vault: report.vault, blank })))
}

async function offerCompletion(
  ctx: MemoryPiContext,
  context: MemoryOperationContext,
  target: BlankTarget,
): Promise<void> {
  const { vault, blank } = target
  const label = `${vault}/${blank.path}`
  const type = await ctx.ui.select(`${COMPLETE_TYPE_TITLE} (${label})`, [...BLANK_NOTE_TYPES])
  if (!isNoteType(type)) return ctx.ui.notify(`${COMPLETE_SKIPPED} ${label}`, "info")
  let body = ""
  if (blank.empty) {
    const typed = await ctx.ui.input(`${COMPLETE_BODY_TITLE} (${label})`)
    if (typeof typed !== "string" || typed.trim() === "") return ctx.ui.notify(`${COMPLETE_SKIPPED} ${label}`, "info")
    body = typed
  }
  const confirmed = await ctx.ui.confirm(`Complete ${label} as a ${type} note?`, COMPLETE_CONFIRM_MESSAGE)
  if (!confirmed) return ctx.ui.notify(`${COMPLETE_SKIPPED} ${label}`, "info")
  const result = await completeBlankMemory(
    { vault, path: blank.path, expectedHash: blank.rawHash, type, body },
    context,
  )
  if (!result.succeeded) return ctx.ui.notify(result.problems.join("\n"), "error")
  const warnings = result.output.maintenanceProblems.map((problem) => `\nMaintenance warning: ${problem}`)
  ctx.ui.notify(`${COMPLETED} ${label} as a ${type} note.${warnings.join("")}`, "info")
}

function isNoteType(value: string | undefined): value is (typeof BLANK_NOTE_TYPES)[number] {
  return typeof value === "string" && BLANK_NOTE_TYPES.some((type) => type === value)
}
