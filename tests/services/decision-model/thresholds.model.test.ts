import { expect, test } from "vitest"

import {
  alternateLabelsOnRequests,
  layaServerUnavailableReason,
  measureGate,
  measureRelevance,
  variantSummary,
} from "#test-helpers"

const unavailable = await layaServerUnavailableReason()

test("measures Laya separation for the gate and for relevance, as shipped and with the labels choice flipped", async (context) => {
  if (unavailable) return context.skip(unavailable)
  const shipped = { gate: await measureGate(), relevance: await measureRelevance() }
  const spy = alternateLabelsOnRequests()
  const alternate = { gate: await measureGate(), relevance: await measureRelevance() }
  spy.mockRestore()
  console.info(
    [
      "### Gate",
      variantSummary("plain noul", alternate.gate),
      variantSummary("noul with labels A/B (shipped)", shipped.gate),
      "### Relevance",
      variantSummary("plain noul (shipped)", shipped.relevance),
      variantSummary("noul with labels A/B", alternate.relevance),
    ].join("\n\n"),
  )
  expect(shipped.gate).toHaveLength(60)
  expect(alternate.relevance).toHaveLength(48)
}, 900_000)
