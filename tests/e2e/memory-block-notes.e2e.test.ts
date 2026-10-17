import { expect, test } from "vitest"

import { BLOCK_NEEDS_FIXING_HEADING, INVALID_CONFIG_NOTICE } from "#src/pi"
import {
  configuredWorld,
  currentMemorySection,
  dontForgetBlock,
  dontForgetText,
  EMPTY_BLOCK,
  memorySectionHistory,
  noteBlock,
  noteWithId,
  notifySettles,
  RELEASE,
  relevantWorld,
  restartMemory,
  rewriteConfig,
  SAY_OK,
  sectionText,
  storedConfig,
  writeVaultFile,
} from "#test-helpers"

const releaseBlock = noteBlock("global", RELEASE.path, RELEASE.body)

test("an unmarked note stays out of the block", async () => {
  const world = await relevantWorld()
  await writeVaultFile(world.folders.globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  await writeVaultFile(world.folders.globalVault, "tools/Plain.md", noteWithId(2, "Nothing special.", []))
  await restartMemory(world)
  await world.pi.prompt(SAY_OK, [])
  expect(await currentMemorySection(world)).toBe(sectionText(dontForgetBlock([releaseBlock])))
})

test("a marked note with invalid frontmatter is not loaded", async () => {
  const world = await relevantWorld()
  await writeVaultFile(
    world.folders.globalVault,
    RELEASE.path,
    noteWithId(1, RELEASE.body, ["dontForget: true", "colour: red"]),
  )
  await restartMemory(world)
  await world.pi.prompt(SAY_OK, [])
  expect(await currentMemorySection(world)).toBe(EMPTY_BLOCK)
})

test("a marked note over a lowered body limit is loaded together with its problems", async () => {
  const world = await relevantWorld()
  await writeVaultFile(world.folders.globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  const { limits } = await storedConfig(world)
  const maxBodyChars = 5
  await rewriteConfig(world, { limits: { ...limits, maxBodyChars } })
  await restartMemory(world)
  await world.pi.prompt(SAY_OK, [])
  const problem = `- body: has ${RELEASE.body.length} characters, the limit is ${maxBodyChars}`
  const note = [releaseBlock, BLOCK_NEEDS_FIXING_HEADING, problem].join("\n")
  expect(await currentMemorySection(world)).toBe(sectionText(dontForgetBlock([note])))
})

test("with no project only the global vault is read", async () => {
  const world = await relevantWorld()
  await writeVaultFile(world.folders.globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  await writeVaultFile(world.folders.projectVault, "deploy/Other.md", dontForgetText(2, "A project rule."))
  await rewriteConfig(world, { projects: [] })
  await restartMemory(world)
  await world.pi.prompt(SAY_OK, [])
  expect(await currentMemorySection(world)).toBe(sectionText(dontForgetBlock([releaseBlock])))
})

test("an invalid config leaves the session without a block", async () => {
  const world = await configuredWorld({ capture: "at-session-end", session: "saved" })
  await rewriteConfig(world, { limits: { maxBodyChars: -1, maxStatementChars: -1, maxNotesPerFolder: -1 } })
  await world.restart()
  await world.pi.waitFor(notifySettles([INVALID_CONFIG_NOTICE]), 0)
  await world.pi.prompt(SAY_OK, [])
  expect(await memorySectionHistory(world)).toEqual([])
})
