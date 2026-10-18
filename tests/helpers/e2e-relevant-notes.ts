import { INVALID_GONE, INVALID_UNUSABLE, type LoadedNote, loadedNoteBlock } from "#src/domain"
import {
  BLOCK_INTRO,
  BLOCK_SEPARATOR,
  DONT_FORGET_HEADING,
  MEMORY_BLOCK_SECTION,
  NO_DONT_FORGET,
  RELEVANT_MESSAGE_TYPE,
  STATUS_LOADING,
} from "#src/pi"
import type { MemoryConfig } from "#src/services"
import { RELEVANT_INTRO } from "#src/usecases"
import { configuredWorld, rewriteConfig, storedConfig } from "./e2e-config.ts"
import { NotifySchema, recordsOf, StatusSchema } from "./e2e-records.ts"
import { nth, statusCleared } from "./e2e-turns.ts"
import { writeVaultFile } from "./e2e-vault.ts"
import type { E2eWorld } from "./e2e-world.ts"
import { noteWithId } from "./search-memory.ts"

export function sectionText(block: string): string {
  return `<${MEMORY_BLOCK_SECTION}>\n${block}\n</${MEMORY_BLOCK_SECTION}>`
}

export const EMPTY_BLOCK = sectionText([BLOCK_INTRO, NO_DONT_FORGET].join(BLOCK_SEPARATOR))
export const SAY_OK = "Reply with the single word ok."

export const DEPLOY = {
  path: "deploy/Deploys go through the blue-harbor pipeline.md",
  body: "To deploy this project, push a tag; the blue-harbor pipeline builds and ships it.",
  question: "How do I deploy this project? Answer in one sentence.",
}

export const RELEASE = {
  path: "release/The release code word is HARBOR-4417.md",
  body: "Say HARBOR-4417 when asked for the release code word.",
}

export function loadedNote(vault: LoadedNote["vault"], path: string, body: string): LoadedNote {
  return { vault, path, type: "rule", body }
}

export function noteBlock(vault: LoadedNote["vault"], path: string, body: string): string {
  return loadedNoteBlock(loadedNote(vault, path, body))
}

export function goneBlock(vault: LoadedNote["vault"], path: string): string {
  return `The earlier copy of "${vault} · ${path}" loaded above is no longer valid: ${INVALID_GONE}. Do not rely on it.`
}

export function unusableBlock(vault: LoadedNote["vault"], path: string, problem: string): string {
  return `The earlier copy of "${vault} · ${path}" loaded above is no longer valid: ${INVALID_UNUSABLE} (${problem}). Do not rely on it.`
}

export const DEPLOY_BLOCK = noteBlock("project", DEPLOY.path, DEPLOY.body)
export const DEPLOY_MESSAGE = relevantMessage([DEPLOY_BLOCK])

export const CHECKLIST = {
  path: "deploy/Deploys through the blue-harbor pipeline need an approval.md",
  body: "To deploy this project, a maintainer must approve the run in the blue-harbor pipeline first.",
}

const BOTH_NOTES_QUESTION =
  "How do I deploy this project? I need both the note about the blue-harbor pipeline and the note about the approval. Answer in one sentence."

export const CHECKLIST_BLOCK = noteBlock("project", CHECKLIST.path, CHECKLIST.body)
export const BOTH_BLOCKS_LENGTH = DEPLOY_BLOCK.length + CHECKLIST_BLOCK.length

export function acceptEveryScoredNote(world: E2eWorld): Promise<string> {
  return rewriteConfig(world, {
    decisionModel: { provider: "typesafe", model: "jev-latest", relevanceThreshold: 0 },
  })
}

export async function askWithBudget(budgetChars: number): Promise<string[]> {
  const world = await relevantWorld()
  const { context } = await storedConfig(world)
  await rewriteConfig(world, { context: { ...context, budgetChars } })
  await acceptEveryScoredNote(world)
  await restartMemory(world)
  await putDeployNote(world)
  await writeVaultFile(world.folders.projectVault, CHECKLIST.path, noteWithId(4, CHECKLIST.body, []))
  await world.pi.prompt(BOTH_NOTES_QUESTION, [])
  return relevantMessages(world)
}

export function dontForgetBlock(blocks: string[]): string {
  return [BLOCK_INTRO, DONT_FORGET_HEADING, ...blocks].join(BLOCK_SEPARATOR)
}

export function relevantMessage(blocks: string[]): string {
  return [RELEVANT_INTRO, ...blocks].join(BLOCK_SEPARATOR)
}

export function dontForgetText(number: number, body: string): string {
  return noteWithId(number, body, ["dontForget: true"])
}

export function relevantWorld(): Promise<E2eWorld> {
  return configuredWorld({ capture: "at-session-end", session: "saved" })
}

export async function restartMemory(world: E2eWorld): Promise<void> {
  await world.restart()
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), 0)
}

export async function resumeLoaded(world: E2eWorld, sessionFile: string): Promise<void> {
  const from = world.pi.lines.length
  await world.pi.switchSession(sessionFile)
  await world.pi.waitFor(nth(statusCleared(STATUS_LOADING.key), 2), from)
}

export function putDeployNote(world: E2eWorld): Promise<void> {
  return writeVaultFile(world.folders.projectVault, DEPLOY.path, noteWithId(2, DEPLOY.body, []))
}

export function statusStates(world: E2eWorld, key: string): (string | undefined)[] {
  return recordsOf(StatusSchema, world.pi.lines)
    .filter((status) => status.statusKey === key)
    .map((status) => status.statusText)
}

export function noticesStarting(world: E2eWorld, prefix: string): string[] {
  return recordsOf(NotifySchema, world.pi.lines)
    .map((notice) => notice.message)
    .filter((message) => message.startsWith(prefix))
}

export async function messageTwiceOnLaya(settings: MemoryConfig["decisionModel"]): Promise<E2eWorld> {
  const world = await relevantWorld()
  await rewriteConfig(world, { decisionModel: settings })
  await restartMemory(world)
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  await world.pi.prompt(DEPLOY.question, [])
  return world
}

export function relevantMessages(world: E2eWorld): Promise<string[]> {
  return world.pi.customMessages(RELEVANT_MESSAGE_TYPE)
}
