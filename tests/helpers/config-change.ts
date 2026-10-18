import { changeSetting, type DecisionFields, type MemoryConfig, type SettingChange } from "#src/domain"
import { aConfig } from "./config.ts"

export const jevDecision = { provider: "typesafe", model: "jev-latest" } as const

export function jevConfig(thresholds: Pick<DecisionFields, "gateThreshold" | "relevanceThreshold">): MemoryConfig {
  return { ...aConfig(), decisionModel: { ...jevDecision, ...thresholds } }
}

export function changed(config: MemoryConfig, change: SettingChange): MemoryConfig {
  const result = changeSetting(config, change, "win32")
  if (!result.succeeded) throw new Error(result.problems.join("; "))
  return result.output
}
