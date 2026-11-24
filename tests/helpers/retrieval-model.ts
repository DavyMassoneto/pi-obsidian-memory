import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent"

import { registryCompletion } from "#src/pi"
import type { CompletionPort, MemoryObservation, MemoryReadAction } from "#src/services"
import { type MemoryOperationContext, observeGet, observeList, observeSearch } from "#src/usecases"
import { requiredEnv } from "./e2e-omniroute.ts"
import { useTempFolder } from "./temp-folder.ts"

export const OMNIROUTE_RETRIEVAL_MODEL = { provider: "omniroute", id: "cx/gpt-6.1-terra" }

export async function omnirouteRetrievalCompletion(): Promise<CompletionPort> {
  const { provider, id } = OMNIROUTE_RETRIEVAL_MODEL
  const root = requiredEnv("OMNIROUTE_URL").trim().replace(/\/+$/, "").replace(/\/v1$/, "")
  requiredEnv("OMNIROUTE_API_KEY")
  const folder = await useTempFolder()
  const modelsPath = join(folder, "models.json")
  const config = {
    baseUrl: `${root}/v1`,
    api: "openai-responses",
    apiKey: "$OMNIROUTE_API_KEY",
    authHeader: true,
    models: [{ id }],
  }
  await writeFile(modelsPath, JSON.stringify({ providers: { [provider]: config } }))
  const runtime = await ModelRuntime.create({ authPath: join(folder, "auth.json"), modelsPath })
  return registryCompletion({ modelRegistry: new ModelRegistry(runtime) })
}

export function observeRetrievalAction(
  action: MemoryReadAction,
  context: MemoryOperationContext,
): Promise<MemoryObservation> {
  if (action.action === "get") return observeGet(action, context)
  if (action.action === "list") return observeList(action.vault, action.folder, context)
  return observeSearch(action.vault, action.query, context)
}
