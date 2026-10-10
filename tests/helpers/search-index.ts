import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { onTestFinished } from "vitest"

import { type IndexEntry, openIndex, type SearchHit, type SearchIndex } from "#/services"

export async function useTempIndex(): Promise<SearchIndex> {
  const folder = await mkdtemp(join(tmpdir(), "index-"))
  const index = openIndex(join(folder, "nested", "vault.sqlite"))

  onTestFinished(async () => {
    index.close()
    await rm(folder, { recursive: true, force: true })
  })

  return index
}

export function anEntry(): IndexEntry {
  return {
    id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
    folder: "tools/pnpm",
    statement: "Use pnpm, never npm",
    body: "Use pnpm for every install and script.",
    type: "rule",
    dontForget: false,
    archived: false,
    size: 120,
    modifiedMs: 1_790_000_000_000,
    hash: "a".repeat(64),
  }
}

export async function useTempFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "index-"))
  onTestFinished(() => rm(folder, { recursive: true, force: true }))
  return folder
}

export function entryWith(id: string, statement: string, body: string): IndexEntry {
  return { ...anEntry(), id, statement, body }
}

export function statementsOf(hits: SearchHit[]): string[] {
  return hits.map((hit) => hit.statement)
}
