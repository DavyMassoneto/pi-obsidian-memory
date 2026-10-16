import { describe, expect, it } from "vitest"

import { checkChatModels } from "#src/services"
import { fakeChatModelPort as fakePort } from "#test-helpers"

const capture = { provider: "anthropic", id: "claude-a" }
const agent = { provider: "openai", id: "gpt-b" }

describe("checkChatModels", () => {
  it("reports ok for registered models whose credentials resolve, in reference order", async () => {
    const port = fakePort([capture, agent], async () => ({ ok: true }))
    expect(await checkChatModels([capture, agent], port)).toEqual([
      { model: capture, status: "ok" },
      { model: agent, status: "ok" },
    ])
    expect(port.auth).toHaveBeenCalledTimes(2)
  })

  it("reports model-not-found without asking for credentials", async () => {
    const port = fakePort([agent], async () => ({ ok: true }))
    expect(await checkChatModels([capture, agent], port)).toEqual([
      { model: capture, status: "model-not-found", problem: "Model anthropic/claude-a is not registered in pi" },
      { model: agent, status: "ok" },
    ])
    expect(port.auth).toHaveBeenCalledOnce()
    expect(port.auth).toHaveBeenCalledWith(agent)
  })

  it("reports no-credentials with the registry's reason, including when the lookup throws", async () => {
    const port = fakePort([capture, agent], async (model) => {
      if (model === capture) return { ok: false, error: "No API key for anthropic" }
      throw new Error("keychain locked")
    })
    expect(await checkChatModels([capture, agent], port)).toEqual([
      { model: capture, status: "no-credentials", problem: "No API key for anthropic" },
      {
        model: agent,
        status: "no-credentials",
        problem: "Credentials for openai/gpt-b could not be resolved: Error: keychain locked",
      },
    ])
  })
})
