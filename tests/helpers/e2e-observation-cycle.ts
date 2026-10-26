import { readFile } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"

import Type, { type Static, type TSchema } from "typebox"

import { RELEVANT_MESSAGE_TYPE } from "#src/pi"
import { OBSERVATIONS_TYPE, ObservationsRecordedSchema, RESUME_TYPE } from "#src/usecases"
import { configuredWorld } from "./e2e-config.ts"
import { folderSnapshot } from "./e2e-folder-snapshot.ts"
import { recordsOf } from "./e2e-records.ts"
import { restartMemory } from "./e2e-relevant-notes.ts"
import { vaultNotes, writeVaultFile } from "./e2e-vault.ts"
import type { E2eWorld } from "./e2e-world.ts"
import type { CycleOverrides } from "./e2e-world-types.ts"
import { noteWithId } from "./search-memory.ts"

export const OBSERVATION_WAIT_MS = 180_000

export const OBSERVATION_LINE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)? {2}\S/m

export const CYCLE_NOTES = [
  {
    path: "csv/CSV files use a semicolon separator.md",
    body: "Every CSV file this project writes uses a semicolon as the separator.",
  },
  {
    path: "deploy/Deploy only with release.sh.md",
    body: "Production deploys run through release.sh and never by hand.",
  },
]

export const CYCLE_FACTS = [
  "Some background on the orders page for this project, so that you know it. " +
    "The orders page lives in src/orders/OrdersPage.tsx and lists every order of the shop with its customer, its total " +
    "and its status. Today it has a button that exports the visible rows to a CSV file, and the export is written in " +
    "src/orders/export.ts by a function called exportOrdersCsv. The shop owner, Marta, asked for a second button next " +
    "to it that exports all the orders instead of only the visible ones. Do not call any tool; reply with only OK.",
  "More background on the same task. Marta decided that the new button must read Exportar tudo in the interface, " +
    "even though the rest of the interface is in English, because her team works in Portuguese. She also decided that " +
    "CSV files must use a semicolon as the separator, because her spreadsheet program is set to the Brazilian locale. " +
    "The tests for the export live in tests/orders/export.test.ts and there are 214 tests in the whole project, all " +
    "passing today. Do not call any tool; reply with only OK.",
  "A last piece of background. The release of this change is planned for next Thursday, and the deploy has to go " +
    "through release.sh because the pipeline refuses anything else. Davy will review the pull request, and he wants " +
    "the export function to stream the rows instead of building the whole file in memory, since the shop has 80000 " +
    "orders. Do not call any tool; reply with only OK.",
]

const OBSERVATIONS_ENTRY_SCHEMA = Type.Object({
  type: Type.Literal("custom"),
  customType: Type.Literal(OBSERVATIONS_TYPE),
  id: Type.String(),
  data: ObservationsRecordedSchema,
})

const COMPACTION_ENTRY_SCHEMA = Type.Object({
  type: Type.Literal("compaction"),
  id: Type.String(),
  summary: Type.String(),
  firstKeptEntryId: Type.String(),
  fromHook: Type.Optional(Type.Boolean()),
  details: Type.Optional(Type.Object({ type: Type.Optional(Type.String()) })),
})

const LISTED_ENTRY_SCHEMA = Type.Object({
  type: Type.String(),
  id: Type.String(),
  customType: Type.Optional(Type.String()),
  message: Type.Optional(Type.Object({ role: Type.String() })),
})

const SOURCE_ROLES = ["user", "assistant", "toolResult", "bashExecution"]

const OWN_MESSAGE_TYPES = [RELEVANT_MESSAGE_TYPE, RESUME_TYPE]

export type ObservationsEntry = Static<typeof OBSERVATIONS_ENTRY_SCHEMA>

export type CompactionEntry = Static<typeof COMPACTION_ENTRY_SCHEMA>

type ListedEntry = Static<typeof LISTED_ENTRY_SCHEMA>

export interface VaultState {
  notes: string[]
  folders: string[][]
}

export function cycleWorld(overrides: CycleOverrides): Promise<E2eWorld> {
  return configuredWorld({ session: "saved", compactsSmallSessions: true, cycle: overrides })
}

export async function seedCycleNotes(world: E2eWorld): Promise<void> {
  for (const [index, note] of CYCLE_NOTES.entries()) {
    await writeVaultFile(world.folders.projectVault, note.path, noteWithId(index + 1, note.body, []))
  }
  await restartMemory(world)
}

export async function vaultState(world: E2eWorld): Promise<VaultState> {
  const vaults = [world.folders.globalVault, world.folders.projectVault]
  const notes = (await Promise.all(vaults.map((vault) => vaultNotes(vault)))).flat()
  return {
    notes: notes.map((note) => `${note.path}\n${note.text}`).sort(),
    folders: await Promise.all(vaults.map((vault) => folderSnapshot(vault))),
  }
}

export async function entriesIn<Schema extends TSchema>(file: string, schema: Schema): Promise<Static<Schema>[]> {
  const text = await readFile(file, "utf8")
  return recordsOf(schema, text.split("\n").slice(0, -1))
}

export function observationEntriesIn(file: string): Promise<ObservationsEntry[]> {
  return entriesIn(file, OBSERVATIONS_ENTRY_SCHEMA)
}

export function compactionsIn(file: string): Promise<CompactionEntry[]> {
  return entriesIn(file, COMPACTION_ENTRY_SCHEMA)
}

export async function waitForEntries<Schema extends TSchema>(
  file: string,
  schema: Schema,
  count: number,
  timeoutMs: number,
): Promise<Static<Schema>[]> {
  const deadline = Date.now() + timeoutMs
  let found = await entriesIn(file, schema)
  while (found.length < count) {
    if (Date.now() >= deadline) throw new Error(`${found.length} of ${count} entries in ${file} after ${timeoutMs} ms`)
    await delay(500)
    found = await entriesIn(file, schema)
  }
  return found
}

export function waitForObservations(file: string, count: number): Promise<ObservationsEntry[]> {
  return waitForEntries(file, OBSERVATIONS_ENTRY_SCHEMA, count, OBSERVATION_WAIT_MS)
}

function isSourceEntry(entry: ListedEntry): boolean {
  if (entry.type === "message") {
    return typeof entry.message?.role === "string" && SOURCE_ROLES.includes(entry.message.role)
  }
  if (entry.type === "custom_message") {
    return typeof entry.customType === "string" && !OWN_MESSAGE_TYPES.includes(entry.customType)
  }
  return entry.type === "branch_summary"
}

export async function sourceIdsIn(file: string): Promise<string[]> {
  return (await entriesIn(file, LISTED_ENTRY_SCHEMA)).filter(isSourceEntry).map((entry) => entry.id)
}

export function sourceIdAfter(sourceIds: string[], id: string): string | null {
  const next = sourceIds[sourceIds.indexOf(id) + 1]
  if (typeof next !== "string") return null
  return next
}
