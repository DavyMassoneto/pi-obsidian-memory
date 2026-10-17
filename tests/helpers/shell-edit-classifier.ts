import { join } from "node:path"

import { ModelRuntime } from "@earendil-works/pi-coding-agent"
import { onTestFinished } from "vitest"

import { shellEditClassifierPrompt } from "#src/pi"
import { defaultJevModel, type ShellEditClassifierPort } from "#src/services"
import type { ShellEditJev } from "#src/usecases"
import { typesafeApiKey } from "./e2e-credentials.ts"
import { useTempFolder } from "./temp-folder.ts"

async function shellEditClassifierWithKey(apiKey: string): Promise<ShellEditClassifierPort> {
  const previous = process.env.TYPESAFE_API_KEY
  process.env.TYPESAFE_API_KEY = apiKey
  onTestFinished(() => {
    if (typeof previous === "string") process.env.TYPESAFE_API_KEY = previous
    else delete process.env.TYPESAFE_API_KEY
  })
  const folder = await useTempFolder()
  const runtime = await ModelRuntime.create({ authPath: join(folder, "auth.json"), modelsPath: null })
  const model = runtime.getModelOfType("classifier", "typesafe", defaultJevModel)
  if (!model) throw new Error(`pi has no typesafe ${defaultJevModel} classifier`)
  return { classify: (request) => runtime.classify(model, shellEditClassifierPrompt(request.context), request.options) }
}

export async function liveShellEditClassifier(): Promise<ShellEditClassifierPort> {
  return shellEditClassifierWithKey(await typesafeApiKey())
}

export async function liveShellEditJev(): Promise<ShellEditJev> {
  return { available: true, classifier: await liveShellEditClassifier() }
}

export async function invalidKeyShellEditJev(): Promise<ShellEditJev> {
  return { available: true, classifier: await shellEditClassifierWithKey("invalid-key") }
}
