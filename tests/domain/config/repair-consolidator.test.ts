import { expect, test } from "vitest"

import { aConfig, inspectConfigForRepair } from "#test-helpers"

test("repair keeps a valid consolidator model and numbers and fills the missing ones with defaults", () => {
  const consolidator = { model: { provider: "keep-provider", id: "keep-id" }, atPoolTokens: 777, extra: 1 }
  const draft = inspectConfigForRepair(JSON.stringify({ ...aConfig(), consolidator }))

  expect(draft.consolidator).toEqual({
    model: consolidator.model,
    thinking: "medium",
    atPoolTokens: 777,
    poolTargetTokens: 10000,
    journeyTokens: 1000,
  })
  expect(draft.problems).toContain("consolidator.extra: not a known field")
})
