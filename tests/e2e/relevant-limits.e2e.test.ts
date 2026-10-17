import { expect, test } from "vitest"

import {
  acceptEveryScoredNote,
  askWithBudget,
  BOTH_BLOCKS_LENGTH,
  CHECKLIST_BLOCK,
  currentMemorySection,
  DEPLOY,
  DEPLOY_BLOCK,
  DEPLOY_MESSAGE,
  dontForgetBlock,
  dontForgetText,
  noteBlock,
  putDeployNote,
  relevantMessage,
  relevantMessages,
  relevantWorld,
  restartMemory,
  sectionText,
  writeVaultFile,
} from "#test-helpers"

const TAG_QUESTION = "What must I do before every deploy of this project? Answer in one sentence."
const TAG_RULE_PATH = "deploy/Tag before every deploy.md"
const bothInEitherOrder = [
  relevantMessage([DEPLOY_BLOCK, CHECKLIST_BLOCK]),
  relevantMessage([CHECKLIST_BLOCK, DEPLOY_BLOCK]),
]

test("the same question twice injects the note once", async () => {
  const world = await relevantWorld()
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  await world.pi.prompt(DEPLOY.question, [])
  expect(await relevantMessages(world)).toEqual([DEPLOY_MESSAGE])
})

test("a budget of exactly the size of both blocks keeps both notes", async () => {
  const messages = await askWithBudget(BOTH_BLOCKS_LENGTH)
  expect(messages).toHaveLength(1)
  expect(bothInEitherOrder).toContain(messages[0])
})

test("a budget one character short of both blocks keeps one note and cuts the other", async () => {
  const messages = await askWithBudget(BOTH_BLOCKS_LENGTH - 1)
  expect(messages).toHaveLength(1)
  expect([relevantMessage([DEPLOY_BLOCK]), relevantMessage([CHECKLIST_BLOCK])]).toContain(messages[0])
})

test("a Don't forget note that is the only answer to the question stays in the section and is not added to a message", async () => {
  const world = await relevantWorld()
  const tagRule = "Before every deploy of this project, push a tag; the blue-harbor pipeline rejects untagged deploys."
  await writeVaultFile(world.folders.projectVault, TAG_RULE_PATH, dontForgetText(3, tagRule))
  await acceptEveryScoredNote(world)
  await restartMemory(world)
  await world.pi.prompt(TAG_QUESTION, [])
  expect(await relevantMessages(world)).toEqual([])
  expect(await currentMemorySection(world)).toBe(
    sectionText(dontForgetBlock([noteBlock("project", TAG_RULE_PATH, tagRule)])),
  )
})
