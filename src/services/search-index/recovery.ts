import { randomUUID } from "node:crypto"
import { renameSync, rmSync } from "node:fs"

import { openIndex } from "./open.ts"
import { indexFailure } from "./refusals.ts"
import type { IndexLocation, IndexReplacement, OpenedIndex, OpenIndexResult } from "./types.ts"

export function recoverIndex(location: IndexLocation): OpenIndexResult {
  const opened = inspectExistingIndex(location)
  if (opened.succeeded || opened.reason !== "corrupted") return opened

  const temporaryPath = `${location.path}.rebuild-${randomUUID()}`
  const replacement = installReplacement({ path: location.path, temporaryPath })
  if (replacement.succeeded) return replacement

  try {
    rmSync(temporaryPath, { force: true })
  } catch (error) {
    if (!(error instanceof Error)) throw error
    replacement.problems.push(`temporary index cleanup failed: ${error.message}`)
  }
  return replacement
}

function inspectExistingIndex(location: IndexLocation): OpenIndexResult {
  const opened = openIndex(location.path)
  if (!opened.succeeded) return opened
  return validateOpenedIndex(opened)
}

function validateOpenedIndex(opened: OpenedIndex): OpenIndexResult {
  const inventory = opened.output.inventory()
  const vectors = opened.output.vectors()
  if (inventory.succeeded && vectors.succeeded) return opened
  const closed = opened.output.close()
  if (!closed.succeeded) return closed
  if (!inventory.succeeded) return inventory
  if (!vectors.succeeded) return vectors
  return opened
}

function installReplacement(request: IndexReplacement): OpenIndexResult {
  try {
    const temporary = openIndex(request.temporaryPath)
    if (!temporary.succeeded) return temporary
    const closed = temporary.output.close()
    if (!closed.succeeded) return closed
    renameSync(request.temporaryPath, request.path)
    const opened = openIndex(request.path)
    if (!opened.succeeded) return opened
    return { ...opened, rebuilt: true }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return indexFailure(error)
  }
}
