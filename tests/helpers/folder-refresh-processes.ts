import { fork } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { onTestFinished } from "vitest"

import { renderNote } from "#src/domain"
import { aNote } from "./note.ts"
import { putNoteFile } from "./vault.ts"

const CHILD_ENTRY = fileURLToPath(new URL("./folder-refresh-child.ts", import.meta.url))

export interface RefreshTally {
  runs: number
  incomplete: number
  problems: string[]
}

export interface FolderRefreshProcess {
  ready: Promise<void>
  stopped(): Promise<RefreshTally>
}

export function numberedNote(position: number) {
  const note = aNote()
  const id = `${note.frontmatter.id.slice(0, 24)}${String(position).padStart(2, "0")}`
  return { ...note, statement: `Numbered note ${position}`, frontmatter: { ...note.frontmatter, id } }
}

export async function putNumberedNote(vault: string, folder: string, position: number): Promise<void> {
  const note = numberedNote(position)
  await mkdir(join(vault, folder), { recursive: true })
  await putNoteFile(vault, folder, note.statement, renderNote(note))
}

function tallyOf(message: object): RefreshTally | null {
  if (!("runs" in message) || typeof message.runs !== "number") return null
  if (!("incomplete" in message) || typeof message.incomplete !== "number") return null
  if (!("problems" in message) || !Array.isArray(message.problems)) return null
  const problems = message.problems.filter((problem) => typeof problem === "string")
  return { runs: message.runs, incomplete: message.incomplete, problems }
}

export function folderRefreshProcess(
  role: "refresher" | "reader",
  vault: string,
  folder: string,
): FolderRefreshProcess {
  const child = fork(CHILD_ENTRY, [role, vault, folder], { stdio: ["ignore", "ignore", "ignore", "ipc"], execArgv: [] })
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()))
  onTestFinished(async () => {
    child.kill("SIGKILL")
    await exited
  })
  const ready = new Promise<void>((resolve) => {
    child.once("message", () => resolve())
  })
  const tally = new Promise<RefreshTally>((resolve, reject) => {
    child.on("message", (message) => {
      if (typeof message !== "object") return
      const parsed = tallyOf(message)
      if (parsed) resolve(parsed)
    })
    child.once("exit", () => reject(new Error("folder refresh child exited without a tally")))
  })
  return {
    ready,
    stopped() {
      child.send({ stop: true })
      return tally
    },
  }
}
