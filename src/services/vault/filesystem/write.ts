import { randomUUID } from "node:crypto"
import { link, mkdir, rename, rm, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import { writeFailure } from "./failures.ts"
import type { WriteResult } from "./types.ts"

export async function publishExclusively(path: string, text: string): Promise<WriteResult> {
  return publish(path, text, "create")
}

export async function writeAtomically(path: string, text: string): Promise<WriteResult> {
  return publish(path, text, "replace")
}

async function publish(path: string, text: string, mode: "create" | "replace"): Promise<WriteResult> {
  const temporary = join(dirname(path), `.${basename(path)}.tmp-${randomUUID()}`)
  let result: WriteResult
  let cleanupProblems: string[] = []
  try {
    await writeFile(temporary, text, { flag: "wx" })
    if (mode === "create") await link(temporary, path)
    else await rename(temporary, path)
    result = { succeeded: true }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    result = writeFailure(error, path)
  } finally {
    cleanupProblems = await cleanupTemporary(temporary)
  }
  if (cleanupProblems.length === 0) return result
  if (result.succeeded) return { ...result, maintenanceProblems: cleanupProblems }
  return { ...result, problems: [...result.problems, ...cleanupProblems] }
}

async function cleanupTemporary(path: string): Promise<string[]> {
  try {
    await rm(path, { force: true })
    return []
  } catch (error) {
    if (error instanceof Error) return [`Temporary file ${path} could not be removed: ${error.message}`]
    return [`Temporary file ${path} could not be removed`]
  }
}

export async function createDirectory(path: string): Promise<WriteResult> {
  try {
    await mkdir(path, { recursive: true })
    return { succeeded: true }
  } catch (error) {
    if (error instanceof Error) return writeFailure(error, path)
    throw error
  }
}

export async function removeFile(path: string): Promise<WriteResult> {
  try {
    await rm(path)
    return { succeeded: true }
  } catch (error) {
    if (error instanceof Error) return writeFailure(error, path)
    throw error
  }
}
