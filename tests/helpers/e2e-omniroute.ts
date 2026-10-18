import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { E2E_MODEL, E2E_PROVIDER, repoRoot } from "./e2e-paths.ts"

const EXTENSION_STATE_FOLDER = "pi-omniroute-sync"

export function omnirouteSyncPackageFolder(): string {
  return join(repoRoot, "node_modules", EXTENSION_STATE_FOLDER)
}

export function omnirouteSyncExtensionPath(): string {
  return join(omnirouteSyncPackageFolder(), "src", "pi.ts")
}

export function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(
      `The E2E needs the environment variable ${name}: it reaches OmniRoute and Jev, and CI gets it from a GitHub secret.`,
    )
  }
  return value
}

export async function writeOmnirouteWorld(agentDir: string): Promise<void> {
  const serverUrl = requiredEnv("OMNIROUTE_URL")
  const apiKey = requiredEnv("OMNIROUTE_API_KEY")
  const stateFolder = join(agentDir, "extensions", EXTENSION_STATE_FOLDER)
  await mkdir(stateFolder, { recursive: true })
  await writeFile(join(stateFolder, "settings.json"), JSON.stringify({ serverUrl, providerName: E2E_PROVIDER, apiKey }))
  const baseUrl = `${serverUrl.trim().replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`
  const provider = {
    baseUrl,
    api: "openai-responses",
    auth: "none",
    authHeader: true,
    compat: {
      sessionAffinityFormat: "openrouter",
      promptCacheSessionHeader: "x-session-id",
      supportsLongCacheRetention: true,
    },
    models: [{ id: E2E_MODEL }],
  }
  await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: { [E2E_PROVIDER]: provider } }))
}
