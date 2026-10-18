import { expect, test } from "vitest"

import { cadenceWorld, cursorsIn, PLAIN_PROMPT, promptTimes } from "#test-helpers"

test("closing pi after 2 prompts with a minimum of 2 flushes", async () => {
  const world = await cadenceWorld({ captureSettings: { flushMinTurns: 2 } })
  await promptTimes(world, 2, PLAIN_PROMPT)
  const sessionFile = await world.pi.sessionFile()
  await world.stop()
  expect(await cursorsIn(sessionFile)).toBe(1)
})
