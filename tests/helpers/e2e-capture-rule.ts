import { readFile } from "node:fs/promises"
import { join, posix } from "node:path"

import { expect } from "vitest"

import { CAPTURE_SAVED, STATUS_CAPTURING } from "#src/pi"
import { BLANK_NOTE_TYPES } from "#src/usecases"
import { allNotes, captureStatusTexts, messageEntries, noticeTexts, savedCursors } from "./e2e-capture.ts"
import { localToday, vaultNotes, writeVaultFile } from "./e2e-vault.ts"
import type { E2eWorld } from "./e2e-world.ts"
import { noteWithId } from "./search-memory.ts"

export const RULE_AND_TASK =
  "For your information: in this project we always use pnpm, never npm. Separately, a task for me today: rename the build-cache-9137 folder. Reply with only OK and do not call any tool."

const TASK_MARKER = "build-cache-9137"

export function seedToolingFolder(world: E2eWorld): Promise<void> {
  return writeVaultFile(
    world.folders.projectVault,
    "tooling/Format code with biome.md",
    noteWithId(2, "Biome formats the code.", []),
  )
}

export async function expectRuleSaved(world: E2eWorld, from: number, sessionFile: string): Promise<void> {
  const notes = await allNotes(world)
  expect(notes.some((note) => note.text.includes("pnpm"))).toBe(true)
  expect(notes.some((note) => note.text.includes(TASK_MARKER))).toBe(false)
  expect(world.pi.unexpected).toEqual([])
  expect(await vaultNotes(world.folders.globalVault)).toEqual([])
  const saved = (await vaultNotes(world.folders.projectVault)).filter((note) => note.text.includes("pnpm"))
  expect(saved).toHaveLength(1)
  const [added] = saved
  if (!added) throw new Error("no project note mentions pnpm")
  expect(added.path).toMatch(/^tooling\/[^/]+\.md$/)
  const types = BLANK_NOTE_TYPES.join("|")
  expect(added.text).toMatch(
    new RegExp(
      `^---\\nid: [0-9A-HJKMNP-TV-Z]{26}\\ntype: (${types})\\ncreated: ${localToday()}\\nupdated: ${localToday()}\\n(dontForget: true\\n)?---\\n\\n[^\\n]+\\n$`,
    ),
  )
  const index = await readFile(join(world.folders.projectVault, posix.dirname(added.path), "index.md"), "utf8")
  expect(index).toContain(`[[${added.path.replace(/\.md$/, "")}|`)
  expect(captureStatusTexts(world, from)).toEqual([STATUS_CAPTURING.text, undefined])
  expect(noticeTexts(world, from)).toEqual([`${CAPTURE_SAVED} 1 change(s).`])
  const assistants = (await messageEntries(sessionFile)).filter((entry) => entry.role === "assistant")
  expect(await savedCursors(sessionFile)).toEqual([assistants[2]?.id])
}
