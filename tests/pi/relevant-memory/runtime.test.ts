import { rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, onTestFinished, test } from "vitest"

import {
  decisionServer,
  FINISH_WITH_READS,
  fakePiContext,
  getNote,
  noteWithId,
  putCatalogFile,
  putDontForget,
  putNote,
  relevanceScript,
  relevantPiFixture,
  startedPiFixture,
} from "#test-helpers"

const PNPM = "tools/Use pnpm.md"
const NPM = "tools/Use npm.md"

const RANKED = relevanceScript(
  0.9,
  new Map([
    ["Use pnpm", 0.9],
    ["Use npm", 0.2],
  ]),
)

test("a message that needs no memory adds no message and leaves the section alone", async () => {
  const { pi, context, complete } = await startedPiFixture(
    { laya: relevanceScript(0.05, new Map()), session: [], turns: [] },
    false,
  )
  await pi.startSession(context, "startup")
  const before = (await pi.runTurn(context, "hello")).sections
  const calls = complete.mock.calls.length

  const turn = await pi.runTurn(context, "thanks")

  expect(turn.message).toBeNull()
  expect(turn.sections).toEqual(before)
  expect(complete.mock.calls.length).toBe(calls)
})

test("only the ranked notes come back, as one hidden custom message that says it is only part of memory", async () => {
  const { pi, context } = await startedPiFixture(
    { laya: RANKED, session: [], turns: [getNote(NPM), getNote(PNPM), FINISH_WITH_READS] },
    false,
  )
  await pi.startSession(context, "startup")

  const { message } = await pi.runTurn(context, "which package manager?")

  expect(message).toMatchObject({ customType: "obsidian-memory-relevant", display: false })
  const content = String(message?.content)
  expect(content).toContain("Always pnpm.")
  expect(content).not.toContain("Plain npm.")
  expect(content).toContain("only part of your memory")
  expect(content).toContain("memory_search")
  expect(content).toContain("memory_get")
})

test("earlier messages and the system section stay byte-identical while a later message adds a new note", async () => {
  const script = relevanceScript(
    0.9,
    new Map([
      ["Use pnpm", 0.9],
      ["Use yarn", 0.8],
    ]),
  )
  const { pi, context, vaults } = await startedPiFixture(
    {
      laya: script,
      session: [],
      turns: [getNote(PNPM), FINISH_WITH_READS, getNote("tools/Use yarn.md"), getNote(PNPM), FINISH_WITH_READS],
    },
    false,
  )
  await putNote(vaults.global, "Use yarn", 3, "Yarn too.")
  await pi.startSession(context, "startup")
  const first = await pi.runTurn(context, "first")
  const sectionBefore = JSON.stringify(first.sections)
  const firstText = JSON.stringify(first.message)

  const second = await pi.runTurn(context, "second")

  expect(JSON.stringify(first.message)).toBe(firstText)
  expect(JSON.stringify(second.sections)).toBe(sectionBefore)
  const content = String(second.message?.content)
  expect(content).toContain("Yarn too.")
  expect(content).not.toContain("Always pnpm.")
})

test("an Obsidian edit to a loaded note comes back as a block that replaces the earlier copy", async () => {
  const { pi, context, vaults } = await startedPiFixture(
    { laya: RANKED, session: [], turns: [getNote(PNPM), FINISH_WITH_READS] },
    false,
  )
  await pi.startSession(context, "startup")
  const first = await pi.runTurn(context, "pnpm?")
  const sectionBefore = JSON.stringify(first.sections)
  await putCatalogFile(vaults.global, PNPM, noteWithId(1, "pnpm, with corepack.", []))

  const second = await pi.runTurn(context, "and now?")

  const content = String(second.message?.content)
  expect(content).toContain(`replaces the earlier copy of "global · ${PNPM}"`)
  expect(content).toContain("corepack")
  expect(JSON.stringify(second.sections)).toBe(sectionBefore)
})

test("a loaded note that was deleted is marked no longer valid", async () => {
  const { pi, context, vaults } = await startedPiFixture(
    { laya: RANKED, session: [], turns: [getNote(PNPM), FINISH_WITH_READS] },
    false,
  )
  await pi.startSession(context, "startup")
  await pi.runTurn(context, "pnpm?")
  await rm(join(vaults.global.path, PNPM))

  const { message } = await pi.runTurn(context, "and now?")

  expect(String(message?.content)).toContain("no longer valid")
})

test("session start puts the relevant notes in the section within the budget, once, with Don't forget notes apart", async () => {
  const fixture = await relevantPiFixture({
    laya: RANKED,
    budgetChars: 90,
    session: [getNote("tools/Never rm.md"), getNote(PNPM), getNote("tools/Use yarn.md"), FINISH_WITH_READS],
    turns: [],
  })
  await putDontForget(fixture.vaults.global, "Never rm", 1, "Never rm -rf.")
  await putNote(fixture.vaults.global, "Use pnpm", 2, "Always pnpm.")
  await putNote(fixture.vaults.global, "Use yarn", 3, "Yarn for the old repo, with a long explanation.")
  const { context } = fakePiContext(fixture.workingFolder, { hasUI: false })

  await fixture.pi.startSession(context, "startup")
  const section = String((await fixture.pi.runPrompt(fixture.workingFolder)).obsidian_memory)

  expect(section).toContain("Always pnpm.")
  expect(section).not.toContain("Yarn for the old repo")
  expect(section.split("Never rm -rf.")).toHaveLength(2)
  expect(section).toContain("Relevant long-term memory for this work")
})

test("an unavailable Laya adds nothing, tells the user once per session, and never starts the memory agent", async () => {
  const server = await decisionServer({ body: "", status: 503, delayMs: 0 })
  onTestFinished(() => server.close())
  const { pi, context, notifications, complete } = await startedPiFixture(
    { laya: null, endpoint: server.context.endpoint, session: [], turns: [] },
    true,
  )
  await pi.startSession(context, "startup")
  const calls = complete.mock.calls.length

  const first = await pi.runTurn(context, "pnpm?")
  const second = await pi.runTurn(context, "pnpm??")

  expect(first.message).toBeNull()
  expect(second.message).toBeNull()
  expect(notifications.filter((item) => item.message.includes("decision model is unavailable"))).toHaveLength(1)
  expect(complete.mock.calls.length).toBe(calls)
})

test("a Laya that refuses connections is unavailable, not a crash", async () => {
  const server = await decisionServer({ body: "", status: 200, delayMs: 0 })
  const endpoint = server.context.endpoint
  await server.close()
  const { pi, context, notifications } = await startedPiFixture({ laya: null, endpoint, session: [], turns: [] }, true)
  await pi.startSession(context, "startup")

  const { message } = await pi.runTurn(context, "pnpm?")

  expect(message).toBeNull()
  expect(notifications.map((item) => item.message)).toEqual([expect.stringContaining("unavailable")])
})

test("a note loaded into the section at session start is watched too: an edit later replaces it", async () => {
  const fixture = await relevantPiFixture({ laya: RANKED, session: [getNote(PNPM), FINISH_WITH_READS], turns: [] })
  await putNote(fixture.vaults.global, "Use pnpm", 1, "Always pnpm.")
  const { context } = fakePiContext(fixture.workingFolder, { hasUI: false })
  await fixture.pi.startSession(context, "startup")
  expect(String((await fixture.pi.runPrompt(fixture.workingFolder)).obsidian_memory)).toContain("Always pnpm.")
  await putCatalogFile(fixture.vaults.global, PNPM, noteWithId(1, "pnpm, with corepack.", []))

  const { message } = await fixture.pi.runTurn(context, "and now?")

  expect(String(message?.content)).toContain(`replaces the earlier copy of "global · ${PNPM}"`)
})

test("a run started by a custom message adds nothing and never starts retrieval", async () => {
  const { pi, context, complete } = await startedPiFixture({ laya: RANKED, session: [], turns: [] }, false)
  await pi.startSession(context, "startup")
  const calls = complete.mock.calls.length

  expect(await pi.runCustomStart(context)).toBeNull()
  expect(complete.mock.calls.length).toBe(calls)
})
