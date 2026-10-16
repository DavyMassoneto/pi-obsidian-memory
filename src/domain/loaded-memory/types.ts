import type { ReadObservation } from "#src/domain/memory-agent"

export type LoadedNote = Pick<ReadObservation, "path" | "statement" | "body">
