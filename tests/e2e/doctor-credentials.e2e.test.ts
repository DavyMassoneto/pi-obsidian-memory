import { expect, test } from "vitest"

import { DOCTOR_TITLE, MODELS_HEADING } from "#src/pi"
import { NO_API_KEY } from "#src/services"
import { configuredWorld, onlyNotice, rewriteConfig, runDoctor, storedConfig } from "#test-helpers"

const PROVIDER_WITHOUT_CREDENTIALS = "anthropic"
const MODEL_WITHOUT_CREDENTIALS = "claude-haiku-5-5"

test("with no credentials for the provider, the doctor reports the capture and agent models as unavailable with the missing-key cause", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const model = { provider: PROVIDER_WITHOUT_CREDENTIALS, id: MODEL_WITHOUT_CREDENTIALS }
  const { capture } = await storedConfig(world)
  await rewriteConfig(world, { capture: { ...capture, model }, memoryAgent: { model } })
  const turn = await runDoctor(world, [], 0)
  const report = turn.notifications.filter((notice) => notice.message.startsWith(DOCTOR_TITLE))
  const { message, notifyType } = onlyNotice({ ...turn, notifications: report })
  const label = `${PROVIDER_WITHOUT_CREDENTIALS}/${MODEL_WITHOUT_CREDENTIALS}`
  const cause = `${NO_API_KEY} "${PROVIDER_WITHOUT_CREDENTIALS}"`
  expect(message).toContain(`${MODELS_HEADING}\n- capture ${label}: ${cause}`)
  expect(message).toContain(`- memory agent ${label}: ${cause}`)
  expect(message).not.toContain(`${MODEL_WITHOUT_CREDENTIALS}: ok`)
  expect(notifyType).toBe("warning")
  expect(world.pi.unexpected).toEqual([])
})
