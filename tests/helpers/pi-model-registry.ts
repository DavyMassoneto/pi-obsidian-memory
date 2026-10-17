import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent"
import { vi } from "vitest"

import type { ChatModelPort } from "#src/services"
import { useTempFolder } from "./temp-folder.ts"

type RegistryModel = NonNullable<ReturnType<ModelRegistry["find"]>>

export const LOCAL_PROVIDER = "local-llm"
export const LOCAL_MODEL_ID = "local-model"

const ANTHROPIC_ENV_VARIABLES = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_OAUTH_TOKEN",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_FEDERATION_RULE_ID",
  "ANTHROPIC_ORGANIZATION_ID",
  "ANTHROPIC_IDENTITY_TOKEN_FILE",
]

const LOCAL_MODELS = {
  providers: {
    [LOCAL_PROVIDER]: {
      baseUrl: "http://127.0.0.1:9/v1",
      api: "openai-completions",
      apiKey: "dummy-key",
      models: [{ id: LOCAL_MODEL_ID }],
    },
  },
}

export async function realChatModelPort(): Promise<ChatModelPort<RegistryModel>> {
  for (const name of ANTHROPIC_ENV_VARIABLES) vi.stubEnv(name, "")
  const folder = await useTempFolder()
  const authPath = join(folder, "auth.json")
  const modelsPath = join(folder, "models.json")
  await writeFile(authPath, "{}")
  await writeFile(modelsPath, JSON.stringify(LOCAL_MODELS))
  const runtime = await ModelRuntime.create({ authPath, modelsPath })
  const registry = new ModelRegistry(runtime)
  return {
    find: (provider, id) => registry.find(provider, id),
    auth: (model) => registry.getApiKeyAndHeaders(model),
    configured: (model) => registry.hasConfiguredAuth(model),
  }
}
