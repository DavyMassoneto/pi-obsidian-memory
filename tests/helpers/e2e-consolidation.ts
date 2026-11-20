import { readFile } from "node:fs/promises"
import { join, posix } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

import Type, { type Static } from "typebox"
import { expect } from "vitest"

import { STATUS_CONSOLIDATING } from "#src/pi"
import { BLANK_NOTE_TYPES, CONSOLIDATED_TYPE, ObservationsConsolidatedSchema } from "#src/usecases"
import { configuredWorld } from "./e2e-config.ts"
import { entriesIn } from "./e2e-observation-cycle.ts"
import { restartMemory, statusStates } from "./e2e-relevant-notes.ts"
import { localToday, type VaultNote, vaultNotes, writeVaultFile } from "./e2e-vault.ts"
import type { E2eWorld } from "./e2e-world.ts"
import { noteWithId } from "./search-memory.ts"

export const CONSOLIDATION_WAIT_MS = 240_000

export const TASK_MARKER = "build-cache-9137"

const RULE_TEXT = "pnpm"

const CONSOLIDATION_CYCLE = { observer: { chunkTokens: 200 }, consolidator: { atPoolTokens: 1, poolTargetTokens: 1 } }

const POLL_MS = 500

const SETTLE_MS = 1500

const ENGLISH_WORD = /\b(the|a|an|use|uses|with|do|does|not|never|always|and|or|for|in|is|are|all|run|this|project)\b/i

export const RULE_CONVERSATION = [
  "For your information: in this project we always use pnpm, never npm. Separately, a task for me today: rename the build-cache-9137 folder. Reply with only OK and do not call any tool.",
  "A progress update on that task, only so that you know where I am. I listed the folder a minute ago and it holds " +
    "forty-one files spread over six subfolders, the newest of them written on Tuesday afternoon. I have not touched " +
    "anything yet, I am only counting what is inside, and I will tell you when the count is finished. Reply with only OK " +
    "and do not call any tool.",
  "Another progress update. The count is now finished: the folder holds forty-one files, and the largest one is about " +
    "three megabytes. Nothing else in the repository points at the folder by its old name, so the rename looks safe " +
    "from my side and I will do it after lunch. Reply with only OK and do not call any tool.",
  "One more progress update. After lunch I looked at the folder again and the count has not changed, so I am about to " +
    "start the rename. I will check the result with a directory listing once it is done and tell you what I see. " +
    "Reply with only OK and do not call any tool.",
  "The last progress update for now. The rename is done and the directory listing shows the new name with all forty-one " +
    "files still inside it, so the task is finished from my side and there is nothing left to do about it. " +
    "Reply with only OK and do not call any tool.",
]

export const STATED_SECRET = "tk_live_9f3KxQ27vLm8"

const PORTUGUESE_WORD = /(^|[^\p{L}])(é|não|sempre|nunca|neste|projeto|comando|feito|usar|para)($|[^\p{L}])/iu

export const PORTUGUESE_CONVERSATION = [
  `Para sua informação: neste projeto o deploy de produção é sempre feito com o comando make deploy-prod, nunca à mão, e o token de deploy é ${STATED_SECRET}. Responda apenas OK e não chame nenhuma ferramenta.`,
  "Uma atualização só para você acompanhar. Estou revisando a lista de arquivos da pasta de relatórios: são quarenta e " +
    "um arquivos em seis subpastas, e o mais novo foi gravado na terça à tarde. Ainda não mexi em nada, estou só " +
    "contando o que tem dentro. Responda apenas OK e não chame nenhuma ferramenta.",
  "Outra atualização. A contagem terminou: são quarenta e um arquivos e o maior tem uns três megabytes. Nada mais no " +
    "repositório aponta para a pasta pelo nome antigo, então vou seguir depois do almoço. Responda apenas OK e não " +
    "chame nenhuma ferramenta.",
  "Mais uma atualização. Depois do almoço olhei a pasta de novo e a contagem não mudou, então vou começar agora. Vou " +
    "conferir o resultado com uma listagem do diretório e te digo o que aparecer. Responda apenas OK e não chame " +
    "nenhuma ferramenta.",
  "Última atualização por enquanto. Terminei: a listagem mostra os quarenta e um arquivos no lugar certo, então da " +
    "minha parte não falta mais nada. Responda apenas OK e não chame nenhuma ferramenta.",
]

export const NEXT_TURN_PROMPT = "Responda apenas OK e não chame nenhuma ferramenta."

export async function waitForNoteMentioning(world: E2eWorld, text: string): Promise<VaultNote[]> {
  const deadline = Date.now() + CONSOLIDATION_WAIT_MS
  let found = await notesMentioning(world, text)
  while (found.length === 0) {
    if (Date.now() >= deadline) throw new Error(`no note mentions ${text} after ${CONSOLIDATION_WAIT_MS} ms`)
    await delay(POLL_MS)
    found = await notesMentioning(world, text)
  }
  return found
}

async function notesMentioning(world: E2eWorld, text: string): Promise<VaultNote[]> {
  const vaults = [world.folders.globalVault, world.folders.projectVault]
  const notes = (await Promise.all(vaults.map((vault) => vaultNotes(vault)))).flat()
  return notes.filter((note) => note.text.includes(text))
}

export function expectEnglishNote(note: VaultNote): void {
  expect(note.text).toMatch(savedTodayNoteShape())
  expect(note.text).toMatch(ENGLISH_WORD)
  expect(`${note.path}\n${note.text}`).not.toMatch(PORTUGUESE_WORD)
}

const CONSOLIDATED_ENTRY_SCHEMA = Type.Object({
  type: Type.Literal("custom"),
  customType: Type.Literal(CONSOLIDATED_TYPE),
  id: Type.String(),
  data: ObservationsConsolidatedSchema,
})

export type ConsolidatedEntry = Static<typeof CONSOLIDATED_ENTRY_SCHEMA>

export async function consolidationWorld(): Promise<E2eWorld> {
  const world = await configuredWorld({ session: "saved", compactsSmallSessions: true, cycle: CONSOLIDATION_CYCLE })
  await writeVaultFile(
    world.folders.projectVault,
    "tooling/Format code with biome.md",
    noteWithId(2, "Biome formats the code.", []),
  )
  await restartMemory(world)
  return world
}

export function consolidatedEntriesIn(file: string): Promise<ConsolidatedEntry[]> {
  return entriesIn(file, CONSOLIDATED_ENTRY_SCHEMA)
}

export async function waitForConsolidations(
  file: string,
  count: number,
  timeoutMs: number,
): Promise<ConsolidatedEntry[]> {
  const deadline = Date.now() + timeoutMs
  let found = await consolidatedEntriesIn(file)
  while (found.length < count) {
    if (Date.now() >= deadline)
      throw new Error(`${found.length} of ${count} consolidated entries after ${timeoutMs} ms`)
    await delay(POLL_MS)
    found = await consolidatedEntriesIn(file)
  }
  return found
}

export async function noteMentioning(world: E2eWorld, text: string): Promise<string[]> {
  const vaults = [world.folders.globalVault, world.folders.projectVault]
  const notes = (await Promise.all(vaults.map((vault) => vaultNotes(vault)))).flat()
  return notes.filter((note) => note.text.includes(text)).map((note) => note.path)
}

export async function waitForRuleNote(world: E2eWorld): Promise<void> {
  const deadline = Date.now() + CONSOLIDATION_WAIT_MS
  while ((await noteMentioning(world, RULE_TEXT)).length === 0) {
    if (Date.now() >= deadline) throw new Error(`no note mentions ${RULE_TEXT} after ${CONSOLIDATION_WAIT_MS} ms`)
    await delay(POLL_MS)
  }
}

function consolidating(world: E2eWorld): boolean {
  return statusStates(world, STATUS_CONSOLIDATING.key).at(-1) === STATUS_CONSOLIDATING.text
}

export async function waitForConsolidationIdle(world: E2eWorld): Promise<void> {
  const deadline = Date.now() + CONSOLIDATION_WAIT_MS
  let quietSince = 0
  while (quietSince === 0 || Date.now() - quietSince < SETTLE_MS) {
    if (Date.now() >= deadline) throw new Error(`still consolidating after ${CONSOLIDATION_WAIT_MS} ms`)
    if (consolidating(world)) quietSince = 0
    else if (quietSince === 0) quietSince = Date.now()
    await delay(POLL_MS)
  }
}

export function savedTodayNoteShape(): RegExp {
  const types = BLANK_NOTE_TYPES.join("|")
  return new RegExp(
    `^---\\nid: [0-9A-HJKMNP-TV-Z]{26}\\ntype: (${types})\\ncreated: ${localToday()}\\nupdated: ${localToday()}\\n(dontForget: true\\n)?---\\n\\n[^\\n]+\\n$`,
  )
}

export async function expectRuleNote(world: E2eWorld): Promise<void> {
  const frontmatter = savedTodayNoteShape()
  const saved = (await vaultNotes(world.folders.projectVault)).filter((note) => note.text.includes(RULE_TEXT))
  expect(saved.length).toBeGreaterThan(0)
  for (const note of saved) {
    expect(note.text).toMatch(frontmatter)
    expect(note.text).toMatch(ENGLISH_WORD)
  }
  const inTooling = saved.find((note) => posix.dirname(note.path) === "tooling")
  if (!inTooling)
    throw new Error(`no note about ${RULE_TEXT} is in tooling/: ${saved.map((note) => note.path).join(", ")}`)
  const index = await readFile(join(world.folders.projectVault, "tooling", "index.md"), "utf8")
  expect(index).toContain(`[[${inTooling.path.replace(/\.md$/, "")}|`)
}
