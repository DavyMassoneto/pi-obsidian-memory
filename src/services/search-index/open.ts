import { acquireIndexLock } from "./index-lock.ts"
import { checkIndexPath, openHeldIndex } from "./open-held.ts"
import type { OpenIndexResult } from "./types.ts"

export function openIndex(path: string): OpenIndexResult {
  const refused = checkIndexPath(path)
  if (refused) return refused

  const lock = acquireIndexLock(path)
  if (!lock.succeeded) return lock
  try {
    return openHeldIndex(path)
  } finally {
    lock.output.release()
  }
}
