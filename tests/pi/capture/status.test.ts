import { expect, test } from "vitest"

import { STATUS_CAPTURING } from "#src/pi"
import { assistantEntry, capturePiFixture, eventually, fakePiContext, userEntry } from "#test-helpers"

const branch = [userEntry("1", "I always use pnpm"), assistantEntry("2", [{ type: "text", text: "Noted." }])]
const SHOWN = { key: STATUS_CAPTURING.key, text: STATUS_CAPTURING.text }
const CLEARED = { key: STATUS_CAPTURING.key, text: undefined }

test("the capturing status is shown while a review runs and cleared when it ends", async () => {
  const { pi, complete, workingFolder } = await capturePiFixture("after-each-turn", [{ action: "finish" }])
  const { context, statuses } = fakePiContext(workingFolder, { hasUI: true, branch })
  await pi.startSession(context, "startup")
  await pi.runPrompt(workingFolder)
  statuses.length = 0

  await pi.endAgent(context)

  await eventually(() => expect(complete).toHaveBeenCalledTimes(1))
  await eventually(() => expect(statuses).toEqual([SHOWN, CLEARED]))
})

test("the capturing status is cleared when the review fails", async () => {
  const { pi, complete, workingFolder } = await capturePiFixture("after-each-turn", [{ action: "finish" }])
  pi.failures.cursor = true
  const { context, statuses, notifications } = fakePiContext(workingFolder, { hasUI: true, branch })
  await pi.startSession(context, "startup")
  await pi.runPrompt(workingFolder)
  statuses.length = 0

  await pi.endAgent(context)

  await eventually(() => expect(complete).toHaveBeenCalledTimes(1))
  await eventually(() => expect(notifications).toHaveLength(1))
  expect(statuses).toEqual([SHOWN, CLEARED])
})

test("a review without a UI sets no status", async () => {
  const { pi, complete, workingFolder } = await capturePiFixture("after-each-turn", [{ action: "finish" }])
  const { context, statuses } = fakePiContext(workingFolder, { hasUI: false, branch })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)

  await eventually(() => expect(complete).toHaveBeenCalledTimes(1))
  expect(statuses).toEqual([])
})
