import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  cadenceWorld,
  idOf,
  localToday,
  noteWithId,
  reviewedAfterThreeTurns,
  vaultNotes,
  writeVaultFile,
} from "#test-helpers"

const PNPM_NOTE = "tools/Use pnpm, never npm.md"

test("an update keeps the note's id and sets updated to today", async () => {
  const world = await cadenceWorld({ captureSettings: { nudgeInterval: 1 } })
  const { globalVault } = world.folders
  await writeVaultFile(globalVault, PNPM_NOTE, noteWithId(1, "Every install runs with pnpm.", []))
  await reviewedAfterThreeTurns(
    world,
    "Update to what you know about my pnpm rule: I use pnpm in CI as well, not only locally. Reply with only OK and do not call any tool.",
  )
  const text = await readFile(join(globalVault, PNPM_NOTE), "utf8")
  expect(idOf(text)).toBe("id: 01JABCDE7XKQ2M9V3RTN8WPZ01")
  expect(text).toContain(`updated: ${localToday()}`)
  expect(text).not.toContain("Every install runs with pnpm.")
  expect(text).toContain("CI")
  expect(await vaultNotes(globalVault)).toHaveLength(1)
})
