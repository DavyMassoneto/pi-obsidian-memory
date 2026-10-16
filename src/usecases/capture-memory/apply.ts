import type { CaptureDraft } from "#src/services"
import { addMemory } from "#src/usecases/add-memory"
import { archiveMemory } from "#src/usecases/archive-memory"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { succeedMemory } from "#src/usecases/succeed-memory"
import { updateMemory } from "#src/usecases/update-memory"
import { CHANGED_SINCE_READ, DIFFERENT_NOTE, NO_DETAIL } from "./constants.ts"
import type { AppliedWrite, ChangeAction, FinishedWrite, WriteAction } from "./types.ts"

export async function applyWrite(action: WriteAction, context: MemoryOperationContext): Promise<AppliedWrite> {
  const { vault } = action
  if (action.action === "add") return applyAdd(vault, action.note, context)
  const mismatch = readMismatch(action, context)
  if (mismatch) return outcome(action.action, vault, action.path, "conflict", mismatch)
  if (action.action === "archive") {
    return finished("archive", vault, action.path, await archiveMemory({ vault, path: action.path }, context))
  }
  const { note } = action
  if (action.action === "update") {
    const request = { vault, path: action.path, body: note.body, type: note.type, dontForget: note.dontForget }
    return finished("update", vault, action.path, await updateMemory(request, context))
  }
  const draft = { statement: note.statement, type: note.type, body: note.body, dontForget: note.dontForget }
  const succession = await succeedMemory({ vault, path: action.path, folder: note.folder, draft }, context)
  return finished("succeed", vault, action.path, succession)
}

async function applyAdd(
  vault: AppliedWrite["vault"],
  note: CaptureDraft,
  context: MemoryOperationContext,
): Promise<AppliedWrite> {
  const draft = { statement: note.statement, type: note.type, body: note.body, dontForget: note.dontForget }
  const result = await addMemory({ scope: vault, folder: note.folder, draft }, context)
  if (result.succeeded) return outcome("add", vault, result.output.notePath, "applied", "Saved")
  return outcome("add", vault, `${note.folder}/${note.statement}.md`, "refused", problemsOf(result.problems))
}

function finished(
  operation: AppliedWrite["operation"],
  vault: AppliedWrite["vault"],
  path: string,
  result: FinishedWrite,
): AppliedWrite {
  if (result.succeeded) return outcome(operation, vault, path, "applied", "Applied")
  const detail = problemsOf(result.problems)
  if (result.reason === "conflict") return outcome(operation, vault, path, "conflict", detail)
  return outcome(operation, vault, path, "refused", detail)
}

function outcome(
  operation: AppliedWrite["operation"],
  vault: AppliedWrite["vault"],
  path: string,
  status: AppliedWrite["status"],
  detail: string,
): AppliedWrite {
  return { operation, status, vault, path, detail }
}

function problemsOf(problems: string[]): string {
  const joined = problems.join("; ")
  if (joined === "") return NO_DETAIL
  return joined
}

function readMismatch(action: ChangeAction, context: MemoryOperationContext): string | null {
  const read = context.session.getReceipt(context.stamp, { vault: action.vault, path: action.path })
  if (!read) return null
  if (read.rawHash !== action.expectedHash) return CHANGED_SINCE_READ
  if (read.id !== action.id) return DIFFERENT_NOTE
  return null
}
