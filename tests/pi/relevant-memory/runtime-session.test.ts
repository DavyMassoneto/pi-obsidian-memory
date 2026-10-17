import { expect, onTestFinished, test } from "vitest"

import {
  decisionServer,
  eventually,
  FINISH_WITH_READS,
  fakePiContext,
  getNote,
  layaReplyWithoutRouting,
  noteWithId,
  putCatalogFile,
  putDontForget,
  putNote,
  relevanceScript,
  relevantEntry,
  relevantPiFixture,
  rmNote,
} from "#test-helpers"

const PNPM = "tools/Use pnpm.md"

const RANKED = relevanceScript(0.9, new Map())
const BAD_STEP = getNote("tools/notes.txt")

test("a Don't forget note in the section is watched: an edit later replaces it in the message, not in the section", async () => {
  const fixture = await relevantPiFixture({ laya: RANKED, session: [], turns: [] })
  const path = await putDontForget(fixture.vaults.global, "Never rm", 1, "Never rm -rf.")
  const { context } = fakePiContext(fixture.workingFolder, { hasUI: false })
  await fixture.pi.startSession(context, "startup")
  const first = await fixture.pi.runTurn(context, "hello")
  await putCatalogFile(fixture.vaults.global, path, noteWithId(1, "Never rm, ever.", ["dontForget: true"]))

  const second = await fixture.pi.runTurn(context, "and now?")

  expect(String(first.sections.obsidian_memory)).toContain("Never rm -rf.")
  expect(String(second.message?.content)).toContain(`replaces the earlier copy of "global · ${path}"`)
  expect(String(second.message?.content)).toContain("ever.")
  expect(JSON.stringify(second.sections)).toBe(JSON.stringify(first.sections))
})

test("a Don't forget note that is archived in Obsidian is marked no longer valid in the message", async () => {
  const fixture = await relevantPiFixture({ laya: RANKED, session: [], turns: [] })
  const path = await putDontForget(fixture.vaults.global, "Never rm", 1, "Never rm -rf.")
  const { context } = fakePiContext(fixture.workingFolder, { hasUI: false })
  await fixture.pi.startSession(context, "startup")
  await fixture.pi.runTurn(context, "hello")
  await rmNote(fixture.vaults.global.path, path)

  const { message } = await fixture.pi.runTurn(context, "and now?")

  expect(String(message?.content)).toContain("no longer valid")
})

test("relevant notes that could not be loaded at session start are told once, and the section says so", async () => {
  const fixture = await relevantPiFixture({ laya: RANKED, session: [BAD_STEP, BAD_STEP], turns: [] })
  const { context, notifications } = fakePiContext(fixture.workingFolder, { hasUI: true })

  await fixture.pi.startSession(context, "startup")
  const first = await fixture.pi.runTurn(context, "hello")
  await fixture.pi.startSession(context, "resume")
  await fixture.pi.runTurn(context, "again")

  const section = String(first.sections.obsidian_memory)
  expect(section).toContain("could not be loaded")
  expect(section).toContain("memory_search")
  expect(section).toContain("memory_get")
  expect(notifications.filter((item) => item.message.includes("could not be loaded"))).toHaveLength(2)
})

test("without a UI a failed session-start load is silent but the section still says so", async () => {
  const fixture = await relevantPiFixture({ laya: RANKED, session: [BAD_STEP], turns: [] })
  await putNote(fixture.vaults.global, "Use pnpm", 1, "Always pnpm.")
  const { context, notifications } = fakePiContext(fixture.workingFolder, { hasUI: false })

  await fixture.pi.startSession(context, "startup")
  const { sections } = await fixture.pi.runTurn(context, "hello")

  expect(String(sections.obsidian_memory)).toContain("could not be loaded")
  expect(notifications).toEqual([])
})

test("the message carries the notes it loaded, so a resumed session watches them again", async () => {
  const fixture = await relevantPiFixture({
    laya: relevanceScript(0.9, new Map([["Use pnpm", 0.9]])),
    session: [],
    turns: [getNote(PNPM), FINISH_WITH_READS],
  })
  await putNote(fixture.vaults.global, "Use pnpm", 1, "Always pnpm.")
  const first = fakePiContext(fixture.workingFolder, { hasUI: false })
  await fixture.pi.startSession(first.context, "startup")
  const { message } = await fixture.pi.runTurn(first.context, "pnpm?")
  if (!message) throw new Error("no message")
  const resumed = fakePiContext(fixture.workingFolder, { hasUI: false, branch: [relevantEntry("m1", message)] })
  await fixture.pi.startSession(resumed.context, "resume")
  await fixture.pi.runPrompt(fixture.workingFolder)
  await putCatalogFile(fixture.vaults.global, PNPM, noteWithId(1, "pnpm, with corepack.", []))

  const second = await fixture.pi.runTurn(resumed.context, "and now?")

  expect(message.details).toMatchObject({ loaded: [{ path: PNPM }], forgotten: [] })
  expect(String(second.message?.content)).toContain(`replaces the earlier copy of "global · ${PNPM}"`)
})

test("a custom message of ours with unreadable details is ignored on resume", async () => {
  const fixture = await relevantPiFixture({ laya: RANKED, session: [], turns: [] })
  const garbage = { customType: "obsidian-memory-relevant", content: "x", display: false, details: { loaded: 3 } }
  const resumed = fakePiContext(fixture.workingFolder, { hasUI: false, branch: [relevantEntry("m1", garbage)] })

  await fixture.pi.startSession(resumed.context, "resume")

  expect((await fixture.pi.runTurn(resumed.context, "hello")).message).toBeNull()
})

test("a Laya without routing is told once per session with how to run it", async () => {
  const server = await decisionServer({ body: layaReplyWithoutRouting(0.9), status: 200, delayMs: 0 })
  onTestFinished(() => server.close())
  const fixture = await relevantPiFixture({ laya: null, endpoint: server.context.endpoint, session: [], turns: [] })
  const { context, notifications } = fakePiContext(fixture.workingFolder, { hasUI: true })
  await fixture.pi.startSession(context, "startup")

  await fixture.pi.runTurn(context, "pnpm?")
  await fixture.pi.runTurn(context, "pnpm??")

  const told = notifications.filter((item) => item.message.includes("LAYA_JEV_STRICT"))
  expect(told).toHaveLength(1)
  expect(told[0]?.message).toMatch(/laya-serve without LAYA_JEV_STRICT.*LAYA_HOST/)
})

test("a Laya with no cutoffs is told once per session, adds nothing and asks no model", async () => {
  const fixture = await relevantPiFixture({
    laya: null,
    decisionModel: {
      provider: "laya",
      endpoint: "http://127.0.0.1:1/v1/systemone",
      model: "multilingual",
      maxTokens: 8192,
      headMaxTokens: 192,
    },
    session: [],
    turns: [],
  })
  const { context, notifications } = fakePiContext(fixture.workingFolder, { hasUI: true })
  await fixture.pi.startSession(context, "startup")
  await eventually(() => expect(fixture.complete).toHaveBeenCalledTimes(1))

  const first = await fixture.pi.runTurn(context, "pnpm?")
  await fixture.pi.runTurn(context, "pnpm??")

  expect(first.message).toBeNull()
  expect(fixture.complete).toHaveBeenCalledTimes(1)
  const told = notifications.filter((item) => item.message.includes("/memory-setup"))
  expect(told).toHaveLength(1)
})
