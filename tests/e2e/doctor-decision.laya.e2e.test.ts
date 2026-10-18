import { expect, test } from "vitest"

import { CUTOFFS_HINT } from "#src/pi"
import { ROUTING_MISSING_HELP } from "#src/usecases"
import {
  closedLayaEndpoint,
  DECISION_CUTOFFS,
  doctorReport,
  LAYA_DEFAULTS,
  LAYA_MODEL,
  startLaya,
  worldOnLaya,
} from "#test-helpers"

test("a Laya that answers the probe is ready at its endpoint, with the cutoffs from the config", async () => {
  const { endpoint } = await startLaya(LAYA_DEFAULTS)
  const world = await worldOnLaya({ ...LAYA_MODEL, endpoint, ...DECISION_CUTOFFS })
  const { message, notifyType } = await doctorReport(world)
  expect(message).toContain(`- decision model laya/multilingual: ready (answered at ${endpoint})`)
  expect(message).toContain("- decision cutoffs: gate 0.2 (config), relevance 0.5 (config)")
  expect(notifyType).toBe("info")
})

test("a Laya that is not running is a warning with the endpoint and the cause", async () => {
  const endpoint = await closedLayaEndpoint()
  const world = await worldOnLaya({ ...LAYA_MODEL, endpoint, ...DECISION_CUTOFFS })
  const { message, notifyType } = await doctorReport(world)
  expect(message).toContain(`- decision model laya/multilingual: ${endpoint} is not answering: unavailable`)
  expect(notifyType).toBe("warning")
})

test("a Laya that does not name the model that answered tells to run it without LAYA_JEV_STRICT", async () => {
  const { endpoint } = await startLaya({ ...LAYA_DEFAULTS, jevStrict: true })
  const world = await worldOnLaya({ ...LAYA_MODEL, endpoint, ...DECISION_CUTOFFS })
  const { message, notifyType } = await doctorReport(world)
  expect(message).toContain(`- decision model laya/multilingual: ${endpoint} is not answering: ${ROUTING_MISSING_HELP}`)
  expect(notifyType).toBe("warning")
})

test("a Laya that rejects the probe with 422 is reported with the status and the server's own detail", async () => {
  const budget = LAYA_MODEL.maxTokens / 2
  const { endpoint } = await startLaya({ ...LAYA_DEFAULTS, maxTokenBudget: budget })
  const world = await worldOnLaya({ ...LAYA_MODEL, endpoint, ...DECISION_CUTOFFS })
  const { message, notifyType } = await doctorReport(world)
  expect(message).toContain(
    `- decision model laya/multilingual: ${endpoint} is not answering: http-error (HTTP 422): max_len exceeds server limit (${LAYA_MODEL.maxTokens} > ${budget})`,
  )
  expect(notifyType).toBe("warning")
})

test("a Laya with no cutoffs set is a warning that points to the docs", async () => {
  const world = await worldOnLaya({ ...LAYA_MODEL, endpoint: await closedLayaEndpoint() })
  const { message, notifyType } = await doctorReport(world)
  expect(message).toContain(`- decision cutoffs: gate missing, relevance missing; ${CUTOFFS_HINT}`)
  expect(notifyType).toBe("warning")
})
