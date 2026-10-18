import { expect, test } from "vitest"

import { STATUS_CAPTURING } from "#src/pi"
import {
  cadenceWorld,
  captureStatusTexts,
  messageEntries,
  PLAIN_PROMPT,
  PNPM_RULE,
  promptTimes,
  savedCursors,
  untilCursors,
} from "#test-helpers"

test("each review ends at the last entry it read, and a flush with nothing after the cursor starts no review", async () => {
  const world = await cadenceWorld({ captureSettings: { nudgeInterval: 1, flushMinTurns: 1 } })
  const from = world.pi.lines.length
  await promptTimes(world, 3, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  await untilCursors(sessionFile, 1)
  await world.pi.prompt(PLAIN_PROMPT, [])
  await untilCursors(sessionFile, 2)
  await world.stop()
  const assistants = (await messageEntries(sessionFile)).filter((entry) => entry.role === "assistant")
  expect(await savedCursors(sessionFile)).toEqual([assistants[2]?.id, assistants[3]?.id])
  expect(captureStatusTexts(world, from)).toEqual([STATUS_CAPTURING.text, undefined, STATUS_CAPTURING.text, undefined])
})

test("turns that end while a review runs start no second review", async () => {
  const world = await cadenceWorld({ captureSettings: { nudgeInterval: 1 } })
  const from = world.pi.lines.length
  await promptTimes(world, 2, PLAIN_PROMPT)
  await world.pi.prompt(PNPM_RULE, [])
  await promptTimes(world, 2, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  await untilCursors(sessionFile, 1)
  await world.stop()
  const assistants = (await messageEntries(sessionFile)).filter((entry) => entry.role === "assistant")
  expect(await savedCursors(sessionFile)).toEqual([assistants[2]?.id])
  expect(captureStatusTexts(world, from)).toEqual([STATUS_CAPTURING.text, undefined])
})
