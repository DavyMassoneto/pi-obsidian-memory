import type { WriteFailure } from "#/services/vault/filesystem"
import { NOTE_EXTENSION } from "./constants.ts"
import { displayNotePath } from "./display.ts"
import type { CreateRefusal, ExistingNoteRefusal } from "./types.ts"

export function refuseWrite(folder: string, statement: string, failure: WriteFailure): CreateRefusal {
  const problem = `${displayNotePath(folder, statement)} cannot be written (${failure.code})`
  if (failure.reason === "exists")
    return { succeeded: false, reason: "not-directory", problems: [problem, ...failure.problems.slice(1)] }
  return { succeeded: false, reason: failure.reason, problems: [problem, ...failure.problems.slice(1)] }
}

export function refuseExisting(folder: string, fileName: string): ExistingNoteRefusal {
  const existingStatement = fileName.slice(0, -NOTE_EXTENSION.length)
  return {
    succeeded: false,
    reason: "exists",
    existingStatement,
    problems: [`${displayNotePath(folder, existingStatement)} already exists`],
  }
}
