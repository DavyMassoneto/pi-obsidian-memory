import { expect, test, vi } from "vitest"

import { retrieveMemory } from "#src/usecases"
import { relevantFixture, retrievalCompletion, retrieveWith } from "#test-helpers"

const jev = { provider: "typesafe", model: "jev-latest" } as const
const bareLaya = {
  provider: "laya",
  endpoint: "http://127.0.0.1:1/v1/systemone",
  model: "multilingual",
  maxTokens: 8192,
  headMaxTokens: 192,
} as const

test("a gate score at or below the config's gateThreshold adds nothing, even above Jev's own value", async () => {
  const { result, complete } = await retrieveWith({ ...jev, gateThreshold: 0.95 }, 0.9, 0.9)

  expect(result).toMatchObject({ succeeded: true, output: { text: null, notices: [] } })
  expect(complete).not.toHaveBeenCalled()
})

test("a relevance score below the config's relevanceThreshold leaves the note out", async () => {
  const { result } = await retrieveWith({ ...jev, relevanceThreshold: 0.9 }, 0.9, 0.8)

  expect(result).toMatchObject({ succeeded: true, output: { text: null } })
})

test("without a config value a score at Jev's starting value is enough", async () => {
  const { result } = await retrieveWith(jev, 0.9, 0.5)

  expect(result).toMatchObject({ succeeded: true, output: { text: expect.stringContaining("Always pnpm.") } })
})

test("Laya with no cutoffs adds nothing, asks no model, and tells the user to set them", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: bareLaya })
  const complete = retrievalCompletion([])
  const jevSource = vi.fn(fixture.unavailable)

  const result = await retrieveMemory({ message: "pnpm?" }, fixture.context, {
    complete,
    jev: jevSource,
    loaded: fixture.loaded,
  })

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      text: null,
      notices: [
        expect.stringMatching(/cutoff for gateThreshold and relevanceThreshold;.*docs\/decision-thresholds\.md/),
      ],
    },
  })
  expect(complete).not.toHaveBeenCalled()
  expect(jevSource).not.toHaveBeenCalled()
})
