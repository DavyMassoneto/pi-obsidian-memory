import { lstat, readdir, readFile, realpath } from "node:fs/promises"

import { readFailure } from "./failures.ts"
import type { EntriesResult, ExistingFileResult, RawFileResult, RealPathResult, StatResult } from "./types.ts"

export async function readRawFile(path: string): Promise<RawFileResult> {
  try {
    return { succeeded: true, output: await readFile(path) }
  } catch (error) {
    if (error instanceof Error) return readFailure(error, path)
    throw error
  }
}

export async function linkStatOf(path: string): Promise<StatResult> {
  try {
    return { succeeded: true, output: await lstat(path) }
  } catch (error) {
    if (error instanceof Error) return readFailure(error, path)
    throw error
  }
}

export async function realPathOf(path: string): Promise<RealPathResult> {
  try {
    return { succeeded: true, output: await realpath(path) }
  } catch (error) {
    if (error instanceof Error) return readFailure(error, path)
    throw error
  }
}

export async function directoryEntriesOf(path: string): Promise<EntriesResult> {
  try {
    return { succeeded: true, output: await readdir(path, { withFileTypes: true }) }
  } catch (error) {
    if (error instanceof Error) return readFailure(error, path)
    throw error
  }
}

export async function findFileIgnoringCase(directory: string, fileName: string): Promise<ExistingFileResult> {
  const entries = await directoryEntriesOf(directory)
  if (!entries.succeeded) return entries
  const found = entries.output.find((entry) => entry.name.toLowerCase() === fileName.toLowerCase())
  if (found) return { succeeded: true, output: found.name }
  return { succeeded: false, reason: "not-found", code: "ENOENT", problems: [`${fileName} does not exist`] }
}
