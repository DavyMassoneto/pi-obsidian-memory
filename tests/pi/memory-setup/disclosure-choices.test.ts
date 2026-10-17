import { expect, test } from "vitest"

import { SETUP_CREATE_OPTION } from "#src/pi"
import { piRegistrationFixture, repairContext, writeAgentConfig } from "#test-helpers"

const LAYA = {
  provider: "laya",
  endpoint: "http://127.0.0.1:8000/v1/systemone",
  model: "multilingual",
  maxTokens: 8192,
  headMaxTokens: 192,
}

test.each([
  {
    chosen: "Jev",
    settings: { decisionModel: { provider: "typesafe", model: "jev-latest" } },
    shown: "TypeSafe",
    hidden: "secrets",
  },
  {
    chosen: "a remote embeddings provider",
    settings: { embeddings: { provider: "openai", model: "text-embedding-3-small" }, decisionModel: LAYA },
    shown: "secrets included",
    hidden: "TypeSafe",
  },
])(
  "a repaired config that keeps $chosen shows its warning, and only its warning",
  async ({ settings, shown, hidden }) => {
    const fixture = await piRegistrationFixture()
    await writeAgentConfig(
      fixture.configPath,
      JSON.stringify({ ...fixture.config, ...settings, limits: { maxBodyChars: -1 } }),
    )
    const { context, prompts, notifications } = repairContext(fixture.workingFolder, [SETUP_CREATE_OPTION], {
      inputs: [fixture.globalVault],
      confirms: [true],
    })

    await fixture.pi.runCommand("memory-setup", context)

    const warning = notifications.find((item) => item.type === "warning")
    expect(warning?.message).toContain(shown)
    expect(warning?.message).not.toContain(hidden)
    expect(prompts.filter((prompt) => prompt.kind === "confirm")).toHaveLength(1)
  },
)
