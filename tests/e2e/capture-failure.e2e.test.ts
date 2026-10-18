import { expect, test } from "vitest"

import { CAPTURE_FAILED, STATUS_CAPTURING } from "#src/pi"
import {
  allNotes,
  cadenceWorld,
  captureStatusTexts,
  E2E_PROVIDER,
  newSessionMeasured,
  noticeTexts,
  PLAIN_PROMPT,
  PNPM_RULE,
  promptTimes,
  reviewedAfterThreeTurns,
  rewriteConfig,
  savedCursors,
  statusSet,
  storedConfig,
} from "#test-helpers"

test("a capture model that pi does not know ends the review with one warning, saves nothing and keeps the cursor", async () => {
  const world = await cadenceWorld({ captureSettings: { nudgeInterval: 1 } })
  const { capture } = await storedConfig(world)
  await rewriteConfig(world, { capture: { ...capture, model: { provider: E2E_PROVIDER, id: "no-such-model" } } })
  const { from } = await reviewedAfterThreeTurns(world, PNPM_RULE)
  expect(noticeTexts(world, from)).toEqual([`${CAPTURE_FAILED} Model call unsupported`])
  expect(captureStatusTexts(world, from)).toEqual([STATUS_CAPTURING.text, undefined])
  expect(await allNotes(world)).toEqual([])
  expect(await savedCursors(await world.pi.sessionFile())).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})

test("a capture model whose provider has no credentials names pi's error in the warning", async () => {
  const world = await cadenceWorld({ captureSettings: { nudgeInterval: 1 } })
  const { capture } = await storedConfig(world)
  await rewriteConfig(world, { capture: { ...capture, model: { provider: "openai", id: "gpt-4o" } } })
  const { from } = await reviewedAfterThreeTurns(world, PNPM_RULE)
  expect(noticeTexts(world, from)).toEqual([`${CAPTURE_FAILED} Model call error: Provider is not configured: openai`])
  expect(captureStatusTexts(world, from)).toEqual([STATUS_CAPTURING.text, undefined])
  expect(await allNotes(world)).toEqual([])
  expect(await savedCursors(await world.pi.sessionFile())).toEqual([])
})

test("a review ended by a new session is an interruption: no warning, no cursor and nothing saved", async () => {
  const world = await cadenceWorld({ captureSettings: { nudgeInterval: 1 } })
  await promptTimes(world, 2, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  const from = world.pi.lines.length
  await world.pi.prompt(PNPM_RULE, [])
  await world.pi.waitFor(statusSet(STATUS_CAPTURING.key), from)
  await newSessionMeasured(world, "review in flight")
  expect(noticeTexts(world, from).filter((text) => text.startsWith(CAPTURE_FAILED))).toEqual([])
  expect(await allNotes(world)).toEqual([])
  expect(await savedCursors(sessionFile)).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})
