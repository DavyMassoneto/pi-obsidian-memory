import { expect, test, vi } from "vitest"

import { MemoryBlock, STATUS_LOADING } from "#src/pi"
import type { CompletionPort } from "#src/services"
import { blockStart, eventually, fakePiContext, piMemoryFixture, promptEvent, registerFakePiAt } from "#test-helpers"

const SHOWN = { key: STATUS_LOADING.key, text: STATUS_LOADING.text }
const CLEARED = { key: STATUS_LOADING.key, text: undefined }

test("the loading status is shown while the block loads and cleared when it is ready", async () => {
  const { context, statuses } = fakePiContext("work", { hasUI: true })
  const gate = Promise.withResolvers<null>()
  const block = new MemoryBlock(async () => ({ succeeded: true, output: { vaults: [] } }))

  block.begin(blockStart(context, () => gate.promise))

  expect(statuses).toEqual([SHOWN])
  gate.resolve(null)
  await block.beforeAgentStart()(promptEvent("work"), context)
  expect(statuses).toEqual([SHOWN, CLEARED])
})

test("the loading status is cleared when the Don't forget load fails", async () => {
  const { context, statuses } = fakePiContext("work", { hasUI: true })
  const block = new MemoryBlock(() => Promise.reject(new Error("disk exploded")))

  block.begin(blockStart(context, async () => null))
  await block.beforeAgentStart()(promptEvent("work"), context)

  expect(statuses).toEqual([SHOWN, CLEARED])
})

test("the loading status is cleared when the relevant notes load fails", async () => {
  const { context, statuses } = fakePiContext("work", { hasUI: true })
  const block = new MemoryBlock(async () => ({ succeeded: true, output: { vaults: [] } }))

  block.begin(blockStart(context, () => Promise.reject(new Error("agent exploded"))))
  await block.beforeAgentStart()(promptEvent("work"), context)

  expect(statuses).toEqual([SHOWN, CLEARED])
})

test("without a UI no status is set", async () => {
  const { context, statuses } = fakePiContext("work", { hasUI: false })
  const block = new MemoryBlock(async () => ({ succeeded: true, output: { vaults: [] } }))

  block.begin(blockStart(context, async () => null))
  await block.beforeAgentStart()(promptEvent("work"), context)

  expect(statuses).toEqual([])
})

test("a session-start load still waiting for the memory agent keeps the status until the session shuts down", async () => {
  const fixture = await piMemoryFixture()
  const hanging = vi.fn<CompletionPort>(() => new Promise<never>(() => undefined))
  const pi = registerFakePiAt(fixture.agentDir, { completionOf: () => hanging })
  const { context, statuses } = fakePiContext(fixture.workingFolder, { hasUI: true })

  await pi.startSession(context, "startup")
  await eventually(() => expect(hanging).toHaveBeenCalled())

  expect(statuses.at(-1)).toEqual(SHOWN)
  await pi.shutdownSession(context)
  await eventually(() => expect(statuses.at(-1)).toEqual(CLEARED))
})
