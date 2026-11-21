import { expect, test } from "vitest"

import { nativeModelCompletion } from "#src/pi"
import { observeHistory } from "#src/usecases"
import { nativePiModels } from "#test-helpers"

test("the native observer produces a provenance-bound commit with host-generated identities", async () => {
  const { registry, model } = await nativePiModels()
  const entries = [
    {
      id: "source-A",
      parentId: null,
      text: "USER: Neste projeto, use sempre pnpm e nunca npm para instalar dependências.",
      tokenCount: 20,
      canStartKeptRange: true,
    },
    {
      id: "source-B",
      parentId: "source-A",
      text: "ASSISTANT: Vou usar pnpm neste projeto.",
      tokenCount: 12,
      canStartKeptRange: true,
    },
  ]
  const result = await observeHistory(
    { entries, model, signal: new AbortController().signal },
    nativeModelCompletion(registry),
  )
  expect(result.succeeded).toBe(true)
  if (!result.succeeded) throw new Error(result.problems.join("; "))
  expect(result.output.sourceEntryIds).toEqual(["source-A", "source-B"])
  expect(result.output.observations.length).toBeGreaterThan(0)
  expect(result.output.observations.map((item) => item.content).join("\n")).toMatch(/pnpm/)
  for (const observation of result.output.observations) {
    expect(observation.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(Number.isNaN(Date.parse(observation.timestamp))).toBe(false)
    expect(observation.sourceEntryIds.every((id) => result.output.sourceEntryIds.includes(id))).toBe(true)
    expect(observation.tokenCount).toBeGreaterThan(0)
  }
})

test("cancellation confirms no sources and returns no observation commit", async () => {
  const { registry, model } = await nativePiModels()
  const controller = new AbortController()
  controller.abort()
  const result = await observeHistory(
    { entries: [], model, signal: controller.signal },
    nativeModelCompletion(registry),
  )
  expect(result).toEqual({ succeeded: false, problems: ["Observation aborted"] })
})

test("a real empty observer response still commits the observed source", async () => {
  const { registry, model } = await nativePiModels()
  const result = await observeHistory(
    {
      entries: [{ id: "empty-source", parentId: null, text: "", tokenCount: 0, canStartKeptRange: true }],
      model,
      signal: new AbortController().signal,
    },
    nativeModelCompletion(registry),
  )
  expect(result).toEqual({ succeeded: true, output: { sourceEntryIds: ["empty-source"], observations: [] } })
})
