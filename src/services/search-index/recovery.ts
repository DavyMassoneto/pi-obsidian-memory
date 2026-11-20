import { randomUUID } from "node:crypto"
import { renameSync, rmSync } from "node:fs"

import { acquireIndexLock } from "./index-lock.ts"
import { checkIndexPath, openHeldIndex } from "./open-held.ts"
import { indexFailure } from "./refusals.ts"
import type { HeldOpenedIndex, IndexLocation, IndexReplacement, OpenIndexResult } from "./types.ts"

export function recoverIndex(location: IndexLocation): OpenIndexResult {
  const refused = checkIndexPath(location.path)
  if (refused) return refused

  const lock = acquireIndexLock(location.path)
  if (!lock.succeeded) return lock
  try {
    return recoverHeldIndex(location)
  } finally {
    lock.output.release()
  }
}

function recoverHeldIndex(location: IndexLocation): OpenIndexResult {
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
  const opened = openHeldIndex(location.path)
  if (!opened.succeeded) return opened
  return validateOpenedIndex(opened)
}

function validateOpenedIndex(opened: HeldOpenedIndex): OpenIndexResult {
  const inventory = opened.output.inventoryHeld()
  const vectors = opened.output.vectorsHeld()
  if (inventory.succeeded && vectors.succeeded) return opened
  const closed = opened.output.close()
  if (!closed.succeeded) return closed
  if (!inventory.succeeded) return inventory
  if (!vectors.succeeded) return vectors
  return opened
}

function installReplacement(request: IndexReplacement): OpenIndexResult {
  try {
    const temporary = openHeldIndex(request.temporaryPath)
    if (!temporary.succeeded) return temporary
    const closed = temporary.output.close()
    if (!closed.succeeded) return closed
    renameSync(request.temporaryPath, request.path)
    const opened = openHeldIndex(request.path)
    if (!opened.succeeded) return opened
    return { ...opened, rebuilt: true }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return indexFailure(error)
  }
}
