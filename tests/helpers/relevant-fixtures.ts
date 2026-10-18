import type { ReadObservation } from "#src/services"
import { observeRead } from "#src/usecases"
import { putNote, relevantFixture } from "./relevant-memory.ts"

export function readNote(path: string, hash: string): ReadObservation {
  return {
    kind: "read",
    vault: "global",
    path,
    id: "01JABCDE7XKQ2M9V3RTN8WPZ01",
    hash: hash.repeat(64),
    statement: "Use pnpm",
    body: "Always pnpm.",
    type: "rule",
    dontForget: false,
  }
}

export async function loadedFixture() {
  const fixture = await relevantFixture()
  const path = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const read = await observeRead({ vault: "global", path }, fixture.context)
  if (typeof read === "string") throw new Error(read)
  fixture.loaded.remember(read)
  return { ...fixture, path }
}
