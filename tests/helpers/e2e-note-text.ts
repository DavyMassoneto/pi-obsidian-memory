import { expect } from "vitest"

import { idOf, localToday, type VaultNote } from "./e2e-vault.ts"
import type { DayWork } from "./types.ts"

export interface DayWindow {
  days: string[]
}

export interface NoteSpec {
  type: string
  body: string
  created: DayWindow
  updated: DayWindow
  archived?: DayWindow
  replaces?: string
  replacedBy?: string
}

export async function inDayWindow(work: DayWork): Promise<DayWindow> {
  const before = localToday()
  await work()
  const after = localToday()
  if (before === after) return { days: [before] }
  return { days: [before, after] }
}

function dayOf(actual: string, field: string, window: DayWindow): string {
  const found = actual.match(new RegExp(`^${field}: (\\d{4}-\\d{2}-\\d{2})$`, "m"))
  const day = found?.[1]
  if (typeof day !== "string") throw new Error(`no ${field} line in ${actual}`)
  expect(window.days, `${field} of ${actual}`).toContain(day)
  return day
}

export function expectedNoteText(actual: string, spec: NoteSpec): string {
  const lines = [
    "---",
    idOf(actual),
    `type: ${spec.type}`,
    `created: ${dayOf(actual, "created", spec.created)}`,
    `updated: ${dayOf(actual, "updated", spec.updated)}`,
  ]
  if (spec.archived) lines.push(`archived: ${dayOf(actual, "archived", spec.archived)}`)
  if (spec.replaces) lines.push(`replaces: "${spec.replaces}"`)
  if (spec.replacedBy) lines.push(`replacedBy: "${spec.replacedBy}"`)
  return [...lines, "---", "", spec.body, ""].join("\n")
}

export function noteTextAt(notes: VaultNote[], path: string): string {
  const note = notes.find((entry) => entry.path === path)
  if (!note) throw new Error(`no note at ${path}; notes: ${notes.map((entry) => entry.path).join(", ")}`)
  return note.text
}
