import { expect, test } from "vitest"

import type { CaptureCadenceSettings } from "#src/domain"
import { STATUS_CAPTURING } from "#src/pi"
import { cadenceWorld, cursorsIn, newSessionMeasured, PLAIN_PROMPT, promptTimes, statusSet } from "#test-helpers"

async function newSessionWhileReviewRuns(settings: Partial<CaptureCadenceSettings>): Promise<number> {
  const world = await cadenceWorld({ captureSettings: settings })
  await promptTimes(world, 2, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  const from = world.pi.lines.length
  await world.pi.prompt(PLAIN_PROMPT, [])
  await world.pi.waitFor(statusSet(STATUS_CAPTURING.key), from)
  await newSessionMeasured(world, "review in flight")
  expect(world.pi.unexpected).toEqual([])
  return cursorsIn(sessionFile)
}

test("a new session started while a review runs and no flush is due aborts the review, which saves no cursor", async () => {
  expect(await newSessionWhileReviewRuns({ nudgeInterval: 1 })).toBe(0)
})

test("a new session started while a review runs and a flush is due aborts the review and the flush saves the cursor", async () => {
  expect(await newSessionWhileReviewRuns({ nudgeInterval: 1, flushMinTurns: 3 })).toBe(1)
})
