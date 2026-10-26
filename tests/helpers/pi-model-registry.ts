import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent"
import { vi } from "vitest"

import type { ChatModelPort } from "#src/services"
import type { DecisionProbe, EmbeddingProbe } from "#src/usecases"
import { useTempFolder } from "./temp-folder.ts"

type RegistryModel = NonNullable<ReturnType<ModelRegistry["find"]>>

export interface RealDiagnoseProbes {
  port: ChatModelPort<RegistryModel>
  embeddings: EmbeddingProbe
  decision: DecisionProbe
}

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

async function realModelRegistry(): Promise<ModelRegistry> {
  for (const name of ANTHROPIC_ENV_VARIABLES) vi.stubEnv(name, "")
  const folder = await useTempFolder()
  const authPath = join(folder, "auth.json")
  const modelsPath = join(folder, "models.json")
  await writeFile(authPath, "{}")
  await writeFile(modelsPath, JSON.stringify(LOCAL_MODELS))
  const runtime = await ModelRuntime.create({ authPath, modelsPath })
  return new ModelRegistry(runtime)
}

async function hasApiKey(registry: ModelRegistry, provider: string): Promise<boolean> {
  const key = await registry.getApiKeyForProvider(provider)
  return typeof key === "string" && key !== ""
}

function chatPortOf(registry: ModelRegistry): ChatModelPort<RegistryModel> {
  return {
    find: (provider, id) => registry.find(provider, id),
    auth: (model) => registry.getApiKeyAndHeaders(model),
    configured: (model) => registry.hasConfiguredAuth(model),
  }
}

export async function realChatModelPort(): Promise<ChatModelPort<RegistryModel>> {
  return chatPortOf(await realModelRegistry())
}

export async function realDiagnoseProbes(modelCachePath: string): Promise<RealDiagnoseProbes> {
  const registry = await realModelRegistry()
  return {
    port: chatPortOf(registry),
    embeddings: { modelCachePath, hasCredentials: (provider) => hasApiKey(registry, provider) },
    decision: {
      hasClassifier: (provider, model) => typeof registry.findOfType("classifier", provider, model) === "object",
      hasCredentials: (provider) => hasApiKey(registry, provider),
    },
  }
}
