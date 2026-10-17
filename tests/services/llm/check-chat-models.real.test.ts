import { afterEach, describe, expect, it, vi } from "vitest"

import { checkChatModels } from "#src/services"
import { LOCAL_MODEL_ID, LOCAL_PROVIDER, realChatModelPort } from "#test-helpers"

const anthropic = { provider: "anthropic", id: "claude-sonnet-4-5" }
const local = { provider: LOCAL_PROVIDER, id: LOCAL_MODEL_ID }

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("checkChatModels against a real pi model registry", () => {
  it("fails Anthropic without configured auth, with pi's wording", async () => {
    const port = await realChatModelPort()
    expect(await checkChatModels([anthropic], port)).toEqual([
      { model: anthropic, status: "no-credentials", problem: 'No API key found for "anthropic"' },
    ])
  })

  it("passes a provider configured with an apiKey in models.json", async () => {
    const port = await realChatModelPort()
    expect(await checkChatModels([local], port)).toEqual([{ model: local, status: "ok" }])
  })
})
