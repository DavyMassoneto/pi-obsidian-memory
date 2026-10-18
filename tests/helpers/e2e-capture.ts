import { readFile } from "node:fs/promises"

import Type from "typebox"

import { CURSOR_TYPE, STATUS_CAPTURING } from "#src/pi"
import { PLAIN_PROMPT, promptTimes } from "./e2e-cadence.ts"
import { NotifySchema, recordOf, recordsOf, StatusSchema } from "./e2e-records.ts"
import type { ReviewedTurns, SessionMessageEntry } from "./e2e-rpc-types.ts"
import { statusCleared } from "./e2e-turns.ts"
import { type VaultNote, vaultNotes } from "./e2e-vault.ts"
import type { E2eWorld } from "./e2e-world.ts"

const CursorEntrySchema = Type.Object({
  type: Type.Literal("custom"),
  customType: Type.Literal(CURSOR_TYPE),
  data: Type.Object({ lastEntryId: Type.String() }),
})

const MessageEntrySchema = Type.Object({
  type: Type.Literal("message"),
  id: Type.String(),
  message: Type.Object({ role: Type.String() }),
})

export function noticeTexts(world: E2eWorld, from: number): string[] {
  return recordsOf(NotifySchema, world.pi.lines.slice(from)).map((notice) => notice.message)
}

async function sessionLines(sessionFile: string): Promise<string[]> {
  const text = await readFile(sessionFile, "utf8")
  return text.split("\n").filter((line) => line.trim() !== "")
}

export async function savedCursors(sessionFile: string): Promise<string[]> {
  return (await sessionLines(sessionFile)).flatMap((line) => {
    const entry = recordOf(CursorEntrySchema, line)
    if (!entry) return []
    return [entry.data.lastEntryId]
  })
}

export async function messageEntries(sessionFile: string): Promise<SessionMessageEntry[]> {
  return (await sessionLines(sessionFile)).flatMap((line) => {
    const entry = recordOf(MessageEntrySchema, line)
    if (!entry) return []
    return [{ id: entry.id, role: entry.message.role }]
  })
}

export async function allNotes(world: E2eWorld): Promise<VaultNote[]> {
  return [...(await vaultNotes(world.folders.globalVault)), ...(await vaultNotes(world.folders.projectVault))]
}

export function captureStatusTexts(world: E2eWorld, from: number): (string | undefined)[] {
  return recordsOf(StatusSchema, world.pi.lines.slice(from))
    .filter((status) => status.statusKey === STATUS_CAPTURING.key)
    .map((status) => status.statusText)
}

export async function reviewedAfterThreeTurns(world: E2eWorld, last: string): Promise<ReviewedTurns> {
  const from = world.pi.lines.length
  await promptTimes(world, 2, PLAIN_PROMPT)
  const turn = await world.pi.prompt(last, [])
  await world.pi.waitFor(statusCleared(STATUS_CAPTURING.key), from)
  await world.pi.commands()
  return { from, turn }
}
