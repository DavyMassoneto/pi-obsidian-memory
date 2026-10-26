import { expect, test } from "vitest"

import {
  CAT_BODY,
  CAT_PATH,
  CAT_QUERY,
  configuredWorld,
  foundLine,
  noteWithId,
  searchAnswer,
  writeVaultFile,
} from "#test-helpers"

test("memory_search finds a note by meaning, with no word in common, through the real local model", async () => {
  const world = await configuredWorld({})
  const { globalVault } = world.folders
  await writeVaultFile(globalVault, CAT_PATH, noteWithId(1, CAT_BODY, []))
  await writeVaultFile(globalVault, "tools/Use pnpm.md", noteWithId(2, "Always pnpm.", []))
  const answer = await searchAnswer(world, CAT_QUERY)
  expect(answer).toEqual({ text: foundLine(CAT_PATH), isError: false })
})
