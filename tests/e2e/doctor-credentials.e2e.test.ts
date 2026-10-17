import { writeFile } from "node:fs/promises"

import { expect, test } from "vitest"

import { DOCTOR_TITLE, MODELS_HEADING } from "#src/pi"
import { NO_API_KEY } from "#src/services"
import {
  configText,
  configuredWorld,
  E2E_MODEL,
  E2E_PROVIDER,
  noMemoryWorld,
  onlyNotice,
  runDoctor,
} from "#test-helpers"

test("with no credentials for the provider, the doctor reports the capture and agent models as unavailable with the missing-key cause", async () => {
  const configured = await configuredWorld({ capture: "at-session-end" })
  const world = await noMemoryWorld({ credentials: "none" })
  await writeFile(world.folders.configPath, await configText(configured))
  await world.restart()
  const turn = await runDoctor(world, [], 0)
  const report = turn.notifications.filter((notice) => notice.message.startsWith(DOCTOR_TITLE))
  const { message, notifyType } = onlyNotice({ ...turn, notifications: report })
  const cause = `${NO_API_KEY} "${E2E_PROVIDER}"`
  expect(message).toContain(`${MODELS_HEADING}\n- capture ${E2E_PROVIDER}/${E2E_MODEL}: ${cause}`)
  expect(message).toContain(`- memory agent ${E2E_PROVIDER}/${E2E_MODEL}: ${cause}`)
  expect(message).not.toContain(`${E2E_MODEL}: ok`)
  expect(notifyType).toBe("warning")
  expect(world.pi.unexpected).toEqual([])
})
