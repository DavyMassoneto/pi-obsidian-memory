import type { LoadDontForgetResult } from "#src/usecases/load-dont-forget"
import type { LoadedMemory } from "./loaded.ts"

export function trackDontForget(loaded: LoadedMemory, result: LoadDontForgetResult): void {
  if (!result.succeeded) return
  for (const vault of result.output.vaults) {
    for (const note of vault.notes) {
      if (note.body.length === 0) continue
      const { vault: scope, path, id, hash, statement, body, type } = note
      loaded.remember({ kind: "read", vault: scope, path, id, hash, statement, body, type, dontForget: true })
    }
  }
}
