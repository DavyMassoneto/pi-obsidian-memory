import { expect, test } from "vitest"

import { registryCompletion } from "#src/pi"
import { assistantMessage, contextReplying } from "#test-helpers"

const request = {
  model: { provider: "test-chat", id: "selected-chat" },
  signal: new AbortController().signal,
  system: "system text",
  data: "data text",
} as const

test("the configured model completes the prompt with the system text, the data as the user message and the model's own output limit", async () => {
  const { context, complete } = contextReplying(assistantMessage([{ type: "text", text: "{}" }], "stop"))

  const result = await registryCompletion(context)(request)

  expect(result).toEqual({ status: "completed", text: "{}" })
  expect(complete).toHaveBeenCalledWith(
    { provider: "test-chat", id: "selected-chat", maxTokens: 4096 },
    { systemPrompt: "system text", messages: [{ role: "user", content: "data text", timestamp: expect.any(Number) }] },
    { signal: request.signal, maxTokens: 4096 },
  )
})

test("a model that pi does not know is unsupported and no completion is attempted", async () => {
  const { context, complete } = contextReplying(null)

  const result = await registryCompletion(context)({ ...request, model: { provider: "other", id: "unknown" } })

  expect(result).toEqual({ status: "unsupported" })
  expect(complete).not.toHaveBeenCalled()
})

test("an aborted completion is reported as aborted", async () => {
  const { context } = contextReplying(assistantMessage([{ type: "text", text: "partial" }], "aborted"))

  expect(await registryCompletion(context)(request)).toEqual({ status: "aborted" })
})

test("a failed completion is reported as an error carrying the provider's message", async () => {
  const { context } = contextReplying({
    ...assistantMessage([{ type: "text", text: "partial" }], "error"),
    errorMessage: "provider down",
  })

  expect(await registryCompletion(context)(request)).toEqual({ status: "error", error: "provider down" })
})

test("a failed completion without a message is reported as an error alone", async () => {
  const { context } = contextReplying(assistantMessage([{ type: "text", text: "partial" }], "error"))

  expect(await registryCompletion(context)(request)).toEqual({ status: "error" })
})

test("a reply with no text is empty", async () => {
  const { context } = contextReplying(assistantMessage([{ type: "thinking", thinking: "only thoughts" }], "stop"))

  expect(await registryCompletion(context)(request)).toEqual({ status: "empty" })
})
