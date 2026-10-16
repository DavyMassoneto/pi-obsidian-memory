import type { ReadObservation } from "#src/domain/memory-agent"

export type LoadedNote = Pick<ReadObservation, "vault" | "path" | "type" | "body">
