import type { Dirent, Stats } from "node:fs"

import type { Done, Failed, Succeeded } from "#/shared"

interface MissingFile extends Failed {
  reason: "not-found"
  code: string
}

interface NotDirectory extends Failed {
  reason: "not-directory"
  code: string
}

interface NotReadable extends Failed {
  reason: "not-readable"
  code: string
}

export type ReadFailure = MissingFile | NotDirectory | NotReadable

export interface WriteFailure extends Failed {
  reason: "not-found" | "not-directory" | "not-writable" | "exists"
  code: string
}

export interface FileWarnings {
  maintenanceProblems?: string[]
}

export type RawFileResult = Succeeded<Buffer> | ReadFailure
export type StatResult = Succeeded<Stats> | ReadFailure
export type RealPathResult = Succeeded<string> | ReadFailure
export type EntriesResult = Succeeded<Dirent[]> | ReadFailure
export type ExistingFileResult = Succeeded<string> | ReadFailure
export type WriteResult = (Done & FileWarnings) | WriteFailure
