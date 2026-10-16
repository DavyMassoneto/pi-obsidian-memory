import type { MemoryConfig, SetupDisclosure } from "./types.ts"

export function setupDisclosures(config: MemoryConfig): SetupDisclosure[] {
  const disclosures: SetupDisclosure[] = ["chat-models"]
  if (config.decisionModel.provider === "typesafe") disclosures.push("jev")
  if (config.embeddings.provider !== "local") disclosures.push("remote-embeddings")
  return disclosures
}
