import { expect, onTestFinished, test, vi } from "vitest"

import { STATUS_SEARCHING } from "#src/pi"
import type { CompletionPort } from "#src/services"
import {
  decisionServer,
  eventually,
  fakePiContext,
  registerFakePiAt,
  relevanceScript,
  relevantPiFixture,
  retrievedInput,
} from "#test-helpers"

const SHOWN = { key: STATUS_SEARCHING.key, text: STATUS_SEARCHING.text }
const CLEARED = { key: STATUS_SEARCHING.key, text: undefined }
const SESSION_QUERY = "Memory relevant to starting work on"
const RANKED = relevanceScript(0.9, new Map())

test("the searching status is shown while a message is searched and cleared when it is done", async () => {
  const fixture = await relevantPiFixture({ laya: RANKED, session: [], turns: [] })
  const { context, statuses } = fakePiContext(fixture.workingFolder, { hasUI: true })
  await fixture.pi.startSession(context, "startup")
  await fixture.pi.runPrompt(fixture.workingFolder)
  statuses.length = 0

  await fixture.pi.runTurn(context, "pnpm?")

  expect(statuses).toEqual([SHOWN, CLEARED])
})

test("the searching status is cleared when the decision model fails", async () => {
  const server = await decisionServer({ body: "{}", status: 500, delayMs: 0 })
  onTestFinished(() => server.close())
  const fixture = await relevantPiFixture({ laya: null, endpoint: server.context.endpoint, session: [], turns: [] })
  const { context, statuses } = fakePiContext(fixture.workingFolder, { hasUI: true })
  await fixture.pi.startSession(context, "startup")
  await fixture.pi.runPrompt(fixture.workingFolder)
  statuses.length = 0

  await fixture.pi.runTurn(context, "pnpm?")

  expect(statuses).toEqual([SHOWN, CLEARED])
})

test("a message with no UI sets no status", async () => {
  const fixture = await relevantPiFixture({ laya: RANKED, session: [], turns: [] })
  const { context, statuses } = fakePiContext(fixture.workingFolder, { hasUI: false })
  await fixture.pi.startSession(context, "startup")

  await fixture.pi.runTurn(context, "pnpm?")

  expect(statuses).toEqual([])
})

test("a message still waiting for the memory agent keeps the status until the session is replaced", async () => {
  const fixture = await relevantPiFixture({ laya: RANKED, session: [], turns: [] })
  const hangingTurns = vi.fn<CompletionPort>(async (request) => {
    if (retrievedInput(request).query.startsWith(SESSION_QUERY)) {
      return { status: "completed", text: JSON.stringify({ action: "finish", notes: [] }) }
    }
    return new Promise<never>(() => undefined)
  })
  const pi = registerFakePiAt(fixture.agentDir, { completionOf: () => hangingTurns })
  const { context, statuses } = fakePiContext(fixture.workingFolder, { hasUI: true })
  await pi.startSession(context, "startup")
  await eventually(() => expect(statuses).toHaveLength(2))
  statuses.length = 0

  const turn = pi.runTurn(context, "pnpm?")
  await eventually(() => expect(hangingTurns).toHaveBeenCalledTimes(2))

  expect(statuses).toEqual([SHOWN])
  await pi.startSession(fakePiContext(fixture.workingFolder, { hasUI: false }).context, "new")
  await turn
  expect(statuses).toEqual([SHOWN, CLEARED])
})
