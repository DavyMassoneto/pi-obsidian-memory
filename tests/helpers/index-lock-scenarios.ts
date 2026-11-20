import { readdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { prepareIndexContents, runIndexOperation, storedNoteIds, writeIsSaved } from "./index-lock-operations.ts"
import {
  holdingProcess,
  type IndexChild,
  insideWaitWindow,
  operatingProcess,
  recoveringProcess,
} from "./index-lock-processes.ts"
import type { IndexOperation } from "./index-lock-wire.ts"
import { changeIndexFile, openedIndex, useIndexFile } from "./search-index.ts"

export type HolderEnding = "release" | "kill"

interface StartedProcesses {
  holder: IndexChild
  operator: IndexChild
}

export interface HeldOperationRun {
  events: string[]
  outcome: string
  expected: string
  savedAfterwards: boolean
  folderFiles: string[]
}

export interface HeldRecoveryRun {
  events: string[]
  rebuilt: boolean[]
  storedIds: string[]
  folderFiles: string[]
}

export const FIRST_RECOVERED_ID = "01JABCDE7XKQ2M9V3RTN8WPZ61"
export const SECOND_RECOVERED_ID = "01JABCDE7XKQ2M9V3RTN8WPZ62"

const WRITES: readonly IndexOperation[] = ["put", "replaceVectors", "recordFolderIndexes"]

async function startedAgainstHeldLock(path: string, operation: IndexOperation): Promise<StartedProcesses> {
  if (operation === "open") {
    const holder = await holdingProcess(path)
    return { holder, operator: operatingProcess(path, operation) }
  }
  const operator = operatingProcess(path, operation)
  await operator.waitFor("opened")
  return { operator, holder: await holdingProcess(path) }
}

async function indexPreparedFor(operation: IndexOperation) {
  const { index, path } = await useIndexFile()
  if (WRITES.includes(operation)) {
    prepareIndexContents(index, "catalog")
    index.close()
    return { path, expected: "" }
  }
  prepareIndexContents(index, "everything")
  const expected = runIndexOperation(index, operation)
  index.close()
  return { path, expected }
}

export async function operationAgainstHeldLock(
  operation: IndexOperation,
  ending: HolderEnding,
): Promise<HeldOperationRun> {
  const { path, expected } = await indexPreparedFor(operation)
  const events: string[] = []
  const { holder, operator } = await startedAgainstHeldLock(path, operation)
  const answer = operator.waitFor("done").then((report) => {
    events.push("answered")
    return report
  })
  operator.send("call")
  await operator.waitFor("ready")
  await insideWaitWindow(answer)
  events.push("signal")
  if (ending === "kill") holder.kill()
  else holder.send("release")
  const answered = await answer
  const saved = !WRITES.includes(operation) || writeIsSaved(openedIndex(path), operation)
  return {
    events,
    outcome: answered.outcome,
    expected,
    savedAfterwards: saved,
    folderFiles: await readdir(dirname(path)),
  }
}

export async function recoveryAgainstHeldLock(corruption: "invalid-row" | "not-a-database"): Promise<HeldRecoveryRun> {
  const { index, path } = await useIndexFile()
  prepareIndexContents(index, "catalog")
  index.close()
  if (corruption === "invalid-row") changeIndexFile(path, "UPDATE notes SET id = 'not-a-ulid'")
  else await writeFile(path, "not a database")
  const events: string[] = []

  const holder = await holdingProcess(path)
  const first = recoveringProcess(path, FIRST_RECOVERED_ID)
  const second = recoveringProcess(path, SECOND_RECOVERED_ID)
  await Promise.all([first.waitFor("ready"), second.waitFor("ready")])
  const recovered = Promise.all([first.waitFor("recovered"), second.waitFor("recovered")]).then((reports) => {
    events.push("answered")
    return reports
  })
  await insideWaitWindow(recovered)
  events.push("signal")
  holder.send("release")
  const reports = await recovered

  first.send("write")
  second.send("write")
  await Promise.all([first.waitFor("written"), second.waitFor("written")])
  return {
    events,
    rebuilt: reports.map((report) => report.outcome === "true"),
    storedIds: storedNoteIds(path),
    folderFiles: await readdir(dirname(path)),
  }
}
