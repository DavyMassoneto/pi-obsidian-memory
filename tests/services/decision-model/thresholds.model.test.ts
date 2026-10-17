import { expect, onTestFinished, test } from "vitest"

import { LAYA_DEFAULTS, measureGate, measureRelevance, startLaya, variantSummary } from "#test-helpers"

test("measures Laya separation for the gate and for relevance on a laya-serve started for the run", async () => {
  const laya = await startLaya(LAYA_DEFAULTS)
  process.env.LAYA_ENDPOINT = laya.endpoint
  onTestFinished(() => {
    delete process.env.LAYA_ENDPOINT
  })
  const gate = await measureGate()
  const relevance = await measureRelevance()
  console.info(
    [
      "### Gate",
      variantSummary("noul with labels A/B (shipped)", gate),
      "### Relevance",
      variantSummary("plain noul (shipped)", relevance),
    ].join("\n\n"),
  )
  expect(gate).toHaveLength(60)
  expect(relevance).toHaveLength(48)
}, 900_000)
