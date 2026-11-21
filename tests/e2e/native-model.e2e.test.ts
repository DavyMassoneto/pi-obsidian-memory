import { expect, test } from "vitest"

import { nativeModelCompletion } from "#src/pi"
import { nativePiModels } from "#test-helpers"

test("memory completion uses the selected native pi model and its existing authentication", async () => {
  const { registry, model } = await nativePiModels()
  const complete = nativeModelCompletion(registry)
  const result = await complete({
    model,
    signal: new AbortController().signal,
    system: "Respond with exactly PI_MODEL_READY. Do not add punctuation or explanations.",
    data: "Confirm the native pi model is available.",
  })
  expect(result).toEqual({ status: "completed", text: "PI_MODEL_READY" })
})
