import type { ReadObservation } from "#src/services"
import type { LoadedChanges } from "./types.ts"

export class LoadedMemory {
  #notes = new Map<string, ReadObservation>()

  all(): ReadObservation[] {
    return [...this.#notes.values()]
  }

  apply(changes: LoadedChanges): void {
    for (const note of changes.forgotten) this.forget(note)
    for (const note of changes.loaded) this.remember(note)
  }

  has(note: ReadObservation): boolean {
    return this.#notes.get(keyOf(note))?.hash === note.hash
  }

  remember(note: ReadObservation): void {
    this.#notes.set(keyOf(note), note)
  }

  forget(note: ReadObservation): void {
    this.#notes.delete(keyOf(note))
  }
}

function keyOf(note: ReadObservation): string {
  return `${note.vault}:${note.path}`
}
