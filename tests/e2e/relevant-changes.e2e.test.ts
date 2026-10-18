import { mkdir, rename, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { replacementBlock } from "#src/domain"
import {
  configuredWorld,
  currentMemorySection,
  DEPLOY,
  DEPLOY_MESSAGE,
  dontForgetText,
  endOf,
  fileExists,
  goneBlock,
  loadedNote,
  memorySectionHistory,
  noteWithId,
  putDeployNote,
  RELEASE,
  relevantMessage,
  relevantMessages,
  relevantWorld,
  restartMemory,
  resumeLoaded,
  rewriteConfig,
  SAY_OK,
  toolCallPrompt,
  unusableBlock,
  writeVaultFile,
} from "#test-helpers"

const newDeployBody = "To deploy this project, push a tag and approve the blue-harbor run."
const deployBefore = loadedNote("project", DEPLOY.path, DEPLOY.body)
const deployAfter = loadedNote("project", DEPLOY.path, newDeployBody)
const releaseBefore = loadedNote("global", RELEASE.path, RELEASE.body)
const releaseAfter = loadedNote("global", RELEASE.path, "Say HARBOR-9001 when asked for the release code word.")

test("an edit to a loaded note comes back as a block that replaces the copy, and a deleted note is marked invalid", async () => {
  const world = await relevantWorld()
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  await writeVaultFile(world.folders.projectVault, DEPLOY.path, noteWithId(2, newDeployBody, []))
  await world.pi.prompt(SAY_OK, [])
  await rm(join(world.folders.projectVault, DEPLOY.path))
  await world.pi.prompt(SAY_OK, [])
  const messages = await relevantMessages(world)
  expect(messages).toEqual([
    DEPLOY_MESSAGE,
    relevantMessage([replacementBlock(deployBefore, deployAfter)]),
    relevantMessage([goneBlock("project", DEPLOY.path)]),
  ])
  expect(await memorySectionHistory(world)).toHaveLength(1)
})

test("a loaded note rewritten with no body is still on disk and is marked still there but unusable", async () => {
  const world = await relevantWorld()
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  await writeVaultFile(world.folders.projectVault, DEPLOY.path, noteWithId(2, "", []))
  await world.pi.prompt(SAY_OK, [])
  expect(await fileExists(join(world.folders.projectVault, DEPLOY.path))).toBe(true)
  expect(await relevantMessages(world)).toEqual([
    DEPLOY_MESSAGE,
    relevantMessage([unusableBlock("project", DEPLOY.path, `${DEPLOY.path} has no body`)]),
  ])
})

test("a loaded note rewritten with broken frontmatter is still on disk and is marked still there but unusable", async () => {
  const world = await relevantWorld()
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  await writeVaultFile(world.folders.projectVault, DEPLOY.path, noteWithId(2, newDeployBody, ["colour: red"]))
  await world.pi.prompt(SAY_OK, [])
  expect(await fileExists(join(world.folders.projectVault, DEPLOY.path))).toBe(true)
  expect(await relevantMessages(world)).toEqual([
    DEPLOY_MESSAGE,
    relevantMessage([
      unusableBlock("project", DEPLOY.path, `${DEPLOY.path} has invalid frontmatter and cannot be changed`),
    ]),
  ])
})

test("a Don't forget note edited or archived later is told in a message and never in the section", async () => {
  const world = await relevantWorld()
  const { globalVault } = world.folders
  await writeVaultFile(globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  await restartMemory(world)
  await world.pi.prompt(SAY_OK, [])
  const section = await currentMemorySection(world)
  await writeVaultFile(globalVault, RELEASE.path, dontForgetText(1, releaseAfter.body))
  await world.pi.prompt(SAY_OK, [])
  await mkdir(join(globalVault, "archive"))
  await rename(join(globalVault, RELEASE.path), join(globalVault, "archive", "Release.md"))
  await world.pi.prompt(SAY_OK, [])
  expect(await relevantMessages(world)).toEqual([
    relevantMessage([replacementBlock(releaseBefore, releaseAfter)]),
    relevantMessage([goneBlock("global", RELEASE.path)]),
  ])
  const history = await memorySectionHistory(world)
  expect(history).toEqual([section])
})

test("a Don't forget note the model rewrites with memory_update comes back as a replacing block", async () => {
  const world = await configuredWorld({
    capture: "at-session-end",
    session: "saved",
    tools: ["memory_get", "memory_update"],
  })
  const { globalVault } = world.folders
  await writeVaultFile(globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  await restartMemory(world)
  const read = { vault: "global", path: RELEASE.path }
  await world.pi.prompt(toolCallPrompt("memory_get", JSON.stringify(read)), [])
  const update = { ...read, body: releaseAfter.body }
  const updated = await world.pi.prompt(toolCallPrompt("memory_update", JSON.stringify(update)), [])
  expect(endOf(updated, "memory_update").isError).toBe(false)
  await world.pi.prompt(SAY_OK, [])
  expect(await relevantMessages(world)).toEqual([relevantMessage([replacementBlock(releaseBefore, releaseAfter)])])
})

test("a resumed session watches the notes its messages loaded", async () => {
  const world = await relevantWorld()
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  const sessionFile = await world.pi.sessionFile()
  await rewriteConfig(world, { memoryAgent: { model: { provider: "e2e-absent", id: "none" } } })
  await restartMemory(world)
  await resumeLoaded(world, sessionFile)
  await writeVaultFile(world.folders.projectVault, DEPLOY.path, noteWithId(2, newDeployBody, []))
  await world.pi.prompt(SAY_OK, [])
  expect(await relevantMessages(world)).toEqual([
    DEPLOY_MESSAGE,
    relevantMessage([replacementBlock(deployBefore, deployAfter)]),
  ])
})
