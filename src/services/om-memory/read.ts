import type { Dirent } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { OM_FOLDER_NAME, OM_GENERATED_INDEX_NAME, OM_SOURCE_EXTENSION } from "./constants.ts"
import { guarded } from "./guarded.ts"
import type { GuardedRead, OmMemoryRefusal, OmMemoryResult, OmSource, ReadProblem } from "./types.ts"

export async function readOmMemory(projectFolder: string): Promise<OmMemoryResult> {
  const root = join(projectFolder, OM_FOLDER_NAME)
  const top = await entriesOf(root)
  if (!top.succeeded) {
    if (top.reason === "not-found") return { succeeded: true, output: [] }
    return refusal(top)
  }

  const names = top.output.filter(isSource).map((entry) => entry.name)
  for (const folder of top.output.filter(isSessionFolder)) {
    const inner = await entriesOf(join(root, folder.name))
    if (!inner.succeeded) return refusal(inner)
    names.push(...inner.output.filter(isSource).map((entry) => `${folder.name}/${entry.name}`))
  }

  const sources: OmSource[] = []
  for (const name of names.sort(compareText)) {
    const file = join(root, name)
    const text = await guarded(file, () => readFile(file, "utf8"))
    if (!text.succeeded) return refusal(text)
    sources.push({ path: `${OM_FOLDER_NAME}/${name}`, text: text.output })
  }
  return { succeeded: true, output: sources }
}

function entriesOf(folder: string): Promise<GuardedRead<Dirent[]>> {
  return guarded(folder, () => readdir(folder, { withFileTypes: true }))
}

function isSource(entry: Dirent): boolean {
  return entry.isFile() && entry.name.endsWith(OM_SOURCE_EXTENSION) && entry.name !== OM_GENERATED_INDEX_NAME
}

function isSessionFolder(entry: Dirent): boolean {
  return entry.isDirectory() && !entry.name.startsWith(".")
}

function refusal(problem: ReadProblem): OmMemoryRefusal {
  return { succeeded: false, reason: "io-error", problems: problem.problems }
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
