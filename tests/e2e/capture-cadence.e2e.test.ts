import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { cadenceWorld, captureStatusTexts, cursorsIn, PLAIN_PROMPT, promptTimes, untilCursors } from "#test-helpers"

test("a review starts on the turn that reaches the turn interval, and not before", async () => {
  const world = await cadenceWorld({ captureSettings: { nudgeInterval: 4 } })
  const from = world.pi.lines.length
  await promptTimes(world, 3, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  expect(await cursorsIn(sessionFile)).toBe(0)
  expect(captureStatusTexts(world, from)).toEqual([])
  await promptTimes(world, 1, PLAIN_PROMPT)
  await untilCursors(sessionFile, 1)
  expect(world.pi.unexpected).toEqual([])
})

test("no review starts before the third user message, even when every turn is a nudge", async () => {
  const world = await cadenceWorld({ captureSettings: { nudgeInterval: 1 } })
  const from = world.pi.lines.length
  await promptTimes(world, 2, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  expect(await cursorsIn(sessionFile)).toBe(0)
  expect(captureStatusTexts(world, from)).toEqual([])
  await promptTimes(world, 1, PLAIN_PROMPT)
  await untilCursors(sessionFile, 1)
  expect(world.pi.unexpected).toEqual([])
})

test("a review starts when the tool calls of the turns reach their threshold", async () => {
  const world = await cadenceWorld({ tools: ["read"], captureSettings: { nudgeToolCalls: 2 } })
  await writeFile(join(world.folders.cwd, "first.txt"), "one")
  await writeFile(join(world.folders.cwd, "second.txt"), "two")
  const from = world.pi.lines.length
  await promptTimes(world, 2, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  expect(await cursorsIn(sessionFile)).toBe(0)
  expect(captureStatusTexts(world, from)).toEqual([])
  await world.pi.prompt(
    "Use the read tool on first.txt and on second.txt, then reply with only OK. Do not call any other tool.",
    [],
  )
  await untilCursors(sessionFile, 1)
  expect(world.pi.unexpected).toEqual([])
})

test.each([
  { prompts: 1, flushes: false },
  { prompts: 2, flushes: true },
])("closing pi after $prompts prompt(s) with a minimum of 2 flushes: $flushes", async ({ prompts, flushes }) => {
  const world = await cadenceWorld({ captureSettings: { flushMinTurns: 2 } })
  await promptTimes(world, prompts, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  await world.stop()
  expect(await cursorsIn(sessionFile)).toBe(Number(flushes))
})

test.each([
  { prompts: 2, flushes: false },
  { prompts: 3, flushes: true },
])("compacting after $prompts prompt(s) with a minimum of 3 flushes: $flushes", async ({ prompts, flushes }) => {
  const world = await cadenceWorld({ compactsSmallSessions: true, captureSettings: { flushMinTurns: 3 } })
  const from = world.pi.lines.length
  await promptTimes(world, prompts, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  await world.pi.compact()
  if (flushes) await untilCursors(sessionFile, 1)
  else {
    expect(captureStatusTexts(world, from)).toEqual([])
    expect(await cursorsIn(sessionFile)).toBe(0)
  }
  expect(world.pi.unexpected).toEqual([])
})
