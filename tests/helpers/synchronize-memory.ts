import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { realpath, stat, utimes, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { promisify } from "node:util"

import { expect } from "vitest"

import { indexFileFor, readIndexInventory, recoverIndex, searchCatalog } from "#src/services"
import { createMemorySession, type MemoryOperationContext, synchronizeMemory } from "#src/usecases"
import { holdFileContentsLocked } from "./locked-file-contents.ts"
import { memoryReadFixture } from "./memory-read.ts"
import { noteText, validFrontmatterLines } from "./note.ts"
import { sessionIdentity } from "./session.ts"
import { putCatalogFile } from "./vault-catalog.ts"

export async function denySynchronizationRead(path: string) {
  const systemRoot = process.env.SystemRoot
  if (typeof systemRoot !== "string") throw new Error("SystemRoot required for Windows read denial")
  const { USERDOMAIN, USERNAME } = process.env
  if (typeof USERDOMAIN !== "string" || typeof USERNAME !== "string") {
    throw new Error("USERDOMAIN and USERNAME required for Windows read denial")
  }
  const user = `${USERDOMAIN}\\${USERNAME}`
  const executable = join(systemRoot, "System32", "icacls.exe")
  const command = promisify(execFile)
  const options = { cwd: dirname(path), env: { SystemRoot: systemRoot }, windowsHide: true }
  const restore = async () => {
    await command(executable, [path, "/remove:d", user], options)
  }
  try {
    await command(executable, [path, "/deny", `${user}:(RD)`], options)
  } catch (error) {
    await restore()
    throw error
  }
  return restore
}

export async function synchronizedIndexPath(context: MemoryOperationContext, vault: string): Promise<string> {
  return indexFileFor(context.indexPath, await realpath(vault))
}

export function synchronizedCatalog(path: string) {
  const opened = recoverIndex({ path })
  if (!opened.succeeded) throw new Error(opened.problems.join("; "))
  try {
    const inventory = readIndexInventory(opened.output)
    const hits = searchCatalog(opened.output, { query: "memory", limit: 100 })
    if (!inventory.succeeded || !hits.succeeded) throw new Error("catalog unavailable")
    return { inventory: inventory.output, hits: hits.output }
  } finally {
    opened.output.close()
  }
}

const PINNED_TIME = new Date("2020-01-01T00:00:00.000Z")

export async function pinIndexTimes(vault: string, folders: string[]): Promise<void> {
  for (const folder of folders) await utimes(join(vault, folder, "index.md"), PINNED_TIME, PINNED_TIME)
}

export async function garbleKeepingStat(path: string): Promise<string> {
  const before = await stat(path)
  if (before.mtimeMs !== PINNED_TIME.getTime()) throw new Error("index times must be pinned and recorded first")
  const garbage = Buffer.alloc(before.size, "g")
  await writeFile(path, garbage)
  await utimes(path, PINNED_TIME, PINNED_TIME)
  return garbage.toString()
}

export function abortWhileFileExists(controller: AbortController, path: string) {
  const state = { armed: true }
  Object.defineProperty(controller.signal, "aborted", { get: () => state.armed && existsSync(path) })
  return {
    disarm() {
      state.armed = false
    },
  }
}

export function inFreshSession(context: MemoryOperationContext): MemoryOperationContext {
  const session = createMemorySession(sessionIdentity())
  return { ...context, session, stamp: session.stamp() }
}

export async function twoFolderFixture() {
  const fixture = await memoryReadFixture()
  await putCatalogFile(fixture.vault, "a/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(fixture.vault, "b/Note.md", noteText(validFrontmatterLines(), "memory"))
  expect((await synchronizeMemory({ vault: "global" }, fixture.context)).succeeded).toBe(true)
  await pinIndexTimes(fixture.vault.path, ["", "a", "b"])
  expect((await synchronizeMemory({ vault: "global" }, fixture.context)).succeeded).toBe(true)
  return fixture
}

type LockedAction<Result> = () => Promise<Result>

export async function whileLocked<Result>(path: string, action: LockedAction<Result>): Promise<Result> {
  const release = await holdFileContentsLocked(path)
  try {
    return await action()
  } finally {
    await release()
  }
}

export function corruptFolderIndexRows(path: string): void {
  const database = new DatabaseSync(path)
  try {
    database.exec("UPDATE folder_indexes SET fingerprint = ''")
  } finally {
    database.close()
  }
}
