import { configuredWorld, rewriteConfig } from "./e2e-config.ts"
import { CAT_BODY, CAT_PATH, foundLine } from "./e2e-semantic.ts"
import { writeVaultFile } from "./e2e-vault.ts"
import type { E2eWorld } from "./e2e-world.ts"
import { noteWithId } from "./search-memory.ts"

export const GOOGLE_EMBEDDINGS = { provider: "google", model: "gemini-embedding-001" } as const
export const OPENAI_EMBEDDINGS = { provider: "openai", model: "text-embedding-3-small" } as const
export const HOOVER_PATH = "home/The hoover is loud.md"

export async function worldWithHooverNote(
  embeddings: typeof GOOGLE_EMBEDDINGS | typeof OPENAI_EMBEDDINGS | null,
  modelCache: "fresh" | "shared",
): Promise<E2eWorld> {
  const world = await configuredWorld({ capture: "at-session-end", modelCache })
  if (embeddings) await rewriteConfig(world, { embeddings })
  await writeVaultFile(world.folders.globalVault, HOOVER_PATH, noteWithId(1, "The hoover is loud.", []))
  return world
}

export function offTwice(reason: string): string {
  const off = `Semantic search is off: ${reason}`
  return `${foundLine(HOOVER_PATH)}\nWarning: ${off}\n${off}`
}

export function stoppedBeforeAnyNote(status: string, notes: number): string {
  return `Warning: Embedding stopped (${status}); 0 of ${notes} notes were embedded before it stopped`
}

export async function freshWorldWithCat(): Promise<E2eWorld> {
  const world = await configuredWorld({ capture: "at-session-end", modelCache: "fresh" })
  await writeVaultFile(world.folders.globalVault, CAT_PATH, noteWithId(1, CAT_BODY, []))
  return world
}
