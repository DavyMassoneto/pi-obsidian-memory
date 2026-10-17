import Type from "typebox"
import { Value } from "typebox/value"

const EnvSchema = Type.Record(Type.String(), Type.Union([Type.String(), Type.Undefined()]))
const NamesSchema = Type.Union([Type.Array(Type.String()), Type.Undefined()])
const PiEnvKeysSchema = Type.Object({ findEnvKeys: Type.Function([Type.String(), EnvSchema], NamesSchema) })

const piEnvKeys = await import(new URL("./env-api-keys.js", import.meta.resolve("@earendil-works/pi-ai")).href)

if (!Value.Check(PiEnvKeysSchema, piEnvKeys)) throw new Error("pi-ai env-api-keys has no findEnvKeys")

export const EMBEDDING_PROVIDERS = ["openai", "google"] as const

export function withoutEmbeddingProviderKeys(env: NodeJS.ProcessEnv): void {
  for (const provider of EMBEDDING_PROVIDERS) {
    const names = piEnvKeys.findEnvKeys(provider, env)
    if (!Value.Check(NamesSchema, names) || !Array.isArray(names)) continue
    for (const name of names) delete env[name]
  }
}
