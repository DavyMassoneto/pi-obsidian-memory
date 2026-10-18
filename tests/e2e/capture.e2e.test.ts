import { test } from "vitest"

import { cadenceWorld, expectRuleSaved, RULE_AND_TASK, reviewedAfterThreeTurns, seedToolingFolder } from "#test-helpers"

test("a review saves the stated project rule in the existing folder and leaves out the task, asking nothing", async () => {
  const world = await cadenceWorld({ captureSettings: { nudgeInterval: 1 } })
  await seedToolingFolder(world)
  const sessionFile = await world.pi.sessionFile()
  const { from } = await reviewedAfterThreeTurns(world, RULE_AND_TASK)
  await expectRuleSaved(world, from, sessionFile)
})
