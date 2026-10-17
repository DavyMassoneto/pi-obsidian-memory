import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { E2eWorld } from "./e2e-world.ts"

export async function writeProviderKey(world: E2eWorld, provider: string, key: string): Promise<void> {
  const credentials = { [provider]: { type: "api_key", key } }
  await writeFile(join(world.folders.agentDir, "auth.json"), JSON.stringify(credentials))
}
