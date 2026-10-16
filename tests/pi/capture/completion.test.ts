import { expect, test } from "vitest"

import { registryCompletion } from "#src/pi"
import { assistantMessage, contextReplying } from "#test-helpers"

const request = {
  model: { provider: "test-chat", id: "selected-chat" },
  signal: new AbortController().signal,
  deadline: Date.now() + 1000,
  round: 1,
  maxRounds: 8,
  maxTokens: 4096,
  system: "system text",
  data: "data text",
} as const

test("the configured model completes the prompt with the system text, the data as the user message and the limits", async () => {
  const { context, complete } = contextReplying(assistantMessage([{ type: "text", text: "{}" }], "stop"))

  const result = await registryCompletion(context)(request)

  expect(result).toEqual({ status: "completed", text: "{}" })
  expect(complete).toHaveBeenCalledWith(
    { provider: "test-chat", id: "selected-chat" },
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

test.each([
  ["aborted", "aborted"],
  ["error", "error"],
] as const)("a %s completion is reported as %s", async (stopReason, status) => {
  const { context } = contextReplying(assistantMessage([{ type: "text", text: "partial" }], stopReason))

  expect(await registryCompletion(context)(request)).toEqual({ status })
})

test("a reply with no text is empty", async () => {
  const { context } = contextReplying(assistantMessage([{ type: "thinking", thinking: "only thoughts" }], "stop"))

  expect(await registryCompletion(context)(request)).toEqual({ status: "empty" })
})
