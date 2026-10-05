import { createHash, randomUUID } from "node:crypto"
import { lstat, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import { HASH_ALGORITHM, NOT_WRITABLE_ERROR_CODES, UNRESOLVABLE_LINK_ERROR_CODES } from "./constants.ts"
import type {
  ErrorCodeResult,
  ExistingFileResult,
  LinkStatResult,
  RawFileResult,
  RealPathResult,
  WriteResult,
} from "./types.ts"

export async function readRawFile(path: string): Promise<RawFileResult> {
  try {
    return { succeeded: true, output: await readFile(path) }
  } catch (error) {
    if (error instanceof Error && isMissingFile(error)) {
      return { succeeded: false }
    }

    throw error
  }
}

export async function linkStatOf(path: string): Promise<LinkStatResult> {
  try {
    return { succeeded: true, output: await lstat(path) }
  } catch (error) {
    if (error instanceof Error && isMissingFile(error)) {
      return { succeeded: false }
    }

    throw error
  }
}

export async function realPathOf(path: string): Promise<RealPathResult> {
  try {
    return { succeeded: true, output: await realpath(path) }
  } catch (error) {
    if (error instanceof Error && isMissingFile(error)) {
      return { succeeded: false }
    }

    throw error
  }
}

export async function linkTargetOf(path: string): Promise<RealPathResult> {
  try {
    return { succeeded: true, output: await realpath(path) }
  } catch (error) {
    if (error instanceof Error && isUnresolvableLink(error)) {
      return { succeeded: false }
    }

    throw error
  }
}

export async function findFileIgnoringCase(directory: string, fileName: string): Promise<ExistingFileResult> {
  const wanted = fileName.toLowerCase()

  for (const entry of await entriesOf(directory)) {
    if (entry.toLowerCase() === wanted) {
      return { succeeded: true, output: entry }
    }
  }

  return { succeeded: false }
}

export async function writeAtomically(path: string, text: string): Promise<WriteResult> {
  const temporary = join(dirname(path), `.${basename(path)}.tmp-${randomUUID()}`)

  try {
    await writeFile(temporary, text)
    await rename(temporary, path)
    return { succeeded: true }
  } catch (error) {
    if (error instanceof Error) {
      const notWritable = notWritableCodeOf(error)
      if (notWritable.succeeded) {
        return { succeeded: false, code: notWritable.output }
      }
    }

    throw error
  } finally {
    await rm(temporary, { force: true })
  }
}

export async function removeFile(path: string): Promise<WriteResult> {
  try {
    await rm(path)
    return { succeeded: true }
  } catch (error) {
    if (error instanceof Error) {
      const notWritable = notWritableCodeOf(error)
      if (notWritable.succeeded) {
        return { succeeded: false, code: notWritable.output }
      }
    }

    throw error
  }
}

export function hashOf(content: Buffer | string): string {
  return createHash(HASH_ALGORITHM).update(content).digest("hex")
}

async function entriesOf(directory: string): Promise<string[]> {
  try {
    return await readdir(directory)
  } catch (error) {
    if (error instanceof Error && isMissingFile(error)) {
      return []
    }

    throw error
  }
}

function isMissingFile(error: Error): boolean {
  return "code" in error && error.code === "ENOENT"
}

function isUnresolvableLink(error: Error): boolean {
  return "code" in error && UNRESOLVABLE_LINK_ERROR_CODES.some((code) => error.code === code)
}

function notWritableCodeOf(error: Error): ErrorCodeResult {
  for (const code of NOT_WRITABLE_ERROR_CODES) {
    if ("code" in error && error.code === code) {
      return { succeeded: true, output: code }
    }
  }

  return { succeeded: false }
}
