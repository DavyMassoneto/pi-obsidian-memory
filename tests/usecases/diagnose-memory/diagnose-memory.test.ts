import { afterEach, expect, test, vi } from "vitest"

import { diagnoseMemory } from "#src/usecases"
import {
  decisionProbeWithoutCredentials,
  embeddingProbeWithoutCredentials,
  LOCAL_MODEL_ID,
  LOCAL_PROVIDER,
  realChatModelPort,
  searchFixture,
  useTempFolder,
  writeRegistrationSnapshot,
} from "#test-helpers"

afterEach(() => {
  vi.unstubAllEnvs()
})

test("the doctor checks the observer and memory agent models", async () => {
  const { context, config } = await searchFixture()
  await writeRegistrationSnapshot(
    context,
    JSON.stringify({
      ...config,
      capture: { ...config.capture, model: { provider: LOCAL_PROVIDER, id: "not-registered" } },
      observer: { ...config.observer, model: { provider: LOCAL_PROVIDER, id: LOCAL_MODEL_ID } },
      memoryAgent: { model: { provider: "anthropic", id: "claude-sonnet-4-5" } },
    }),
  )
  const port = await realChatModelPort()
  const embeddings = embeddingProbeWithoutCredentials(await useTempFolder())
  const decision = decisionProbeWithoutCredentials()

  const result = await diagnoseMemory({ port, embeddings, decision }, context)

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      models: [
        { role: "observer", check: { model: { provider: LOCAL_PROVIDER, id: LOCAL_MODEL_ID }, status: "ok" } },
        {
          role: "memory agent",
          check: { model: { provider: "anthropic", id: "claude-sonnet-4-5" }, status: "no-credentials" },
        },
      ],
    },
  })
})
