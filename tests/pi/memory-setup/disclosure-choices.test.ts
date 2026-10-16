import { mkdir } from "node:fs/promises"

import { expect, test } from "vitest"

import { SETUP_ATTACH_OPTION } from "#src/pi"
import { fakePiContext, piRegistrationFixture, writeAgentConfig } from "#test-helpers"

test.each([
  {
    chosen: "Jev",
    settings: { decisionModel: { provider: "typesafe", model: "jev-latest" } },
    shown: "TypeSafe",
    hidden: "secrets",
  },
  {
    chosen: "a remote embeddings provider",
    settings: {
      embeddings: { provider: "openai", model: "text-embedding-3-small" },
      decisionModel: {
        provider: "laya",
        endpoint: "http://127.0.0.1:8000/v1/systemone",
        model: "multilingual",
        maxTokens: 8192,
        headMaxTokens: 192,
      },
    },
    shown: "secrets included",
    hidden: "TypeSafe",
  },
])("choosing $chosen alone shows its warning, and only its warning", async ({ settings, shown, hidden }) => {
  const fixture = await piRegistrationFixture()
  await mkdir(fixture.globalVault)
  await writeAgentConfig(fixture.configPath, JSON.stringify({ ...fixture.config, ...settings }))
  const { context, prompts, notifications } = fakePiContext(fixture.workingFolder, {
    answers: { selects: [SETUP_ATTACH_OPTION], inputs: [""] },
  })

  await fixture.pi.runCommand("memory-setup", context)

  const warning = notifications.find((item) => item.type === "warning")
  expect(warning?.message).toContain(shown)
  expect(warning?.message).not.toContain(hidden)
  expect(prompts.filter((prompt) => prompt.kind === "confirm")).toEqual([])
})
