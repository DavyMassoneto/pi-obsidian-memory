import { expect, test } from "vitest"

import {
  currentMemorySection,
  DEPLOY,
  dontForgetBlock,
  dontForgetText,
  noteBlock,
  RELEASE,
  relevantWorld,
  writeVaultFile,
} from "#test-helpers"

test("a marked note of each vault is in the block in full, and the model sees it", async () => {
  const world = await relevantWorld()
  await writeVaultFile(world.folders.globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  await writeVaultFile(world.folders.projectVault, DEPLOY.path, dontForgetText(2, DEPLOY.body))
  await world.restart()
  await world.pi.prompt(
    "Without calling any tool, reply with only the release code word from your Don't forget notes.",
    [],
  )
  expect(await currentMemorySection(world)).toContain(
    dontForgetBlock([noteBlock("global", RELEASE.path, RELEASE.body), noteBlock("project", DEPLOY.path, DEPLOY.body)]),
  )
  expect(await world.pi.lastAssistantText()).toContain("HARBOR-4417")
})
