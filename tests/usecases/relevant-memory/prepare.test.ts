import { expect, test, vi } from "vitest"

import { prepareDecisionModel } from "#src/usecases"
import { relevantFixture } from "#test-helpers"

test("a configured Jev is confirmed at startup", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: { provider: "typesafe", model: "jev-latest" } })
  const jev = vi.fn(fixture.unavailable)

  const refusal = await prepareDecisionModel(fixture.context, jev)

  expect(jev).toHaveBeenCalledTimes(1)
  expect(refusal).toContain("no Jev in this test")
})

test("a Jev that is available gives no refusal", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: { provider: "typesafe", model: "jev-latest" } })

  const refusal = await prepareDecisionModel(fixture.context, async () => ({
    available: true,
    classifier: { classify: vi.fn() },
  }))

  expect(refusal).toBeNull()
})

test("Laya needs no confirmation", async () => {
  const fixture = await relevantFixture({ laya: null })
  const jev = vi.fn(fixture.unavailable)

  expect(await prepareDecisionModel(fixture.context, jev)).toBeNull()
  expect(jev).not.toHaveBeenCalled()
})
