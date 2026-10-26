import type {
  ConfigCandidate,
  MemoryConfig,
  NextConfig,
  ParseConfigResult,
  ProjectReplacement,
  SettingNumberKind,
  SettingNumberResult,
} from "#src/domain/config"
import {
  COUNT_REASON,
  COUNT_TEXT,
  parseConfig,
  repairDecision,
  THRESHOLD_REASON,
  THRESHOLD_TEXT,
} from "#src/domain/config"
import type { PathPlatform } from "#src/domain/path-platform"
import type {
  DecisionChange,
  ObserverCountChange,
  ObserverModelChange,
  SettingChange,
  ThinkingChange,
  ThresholdChange,
} from "./types.ts"

export function changeSetting(config: MemoryConfig, change: SettingChange, platform: PathPlatform): ParseConfigResult {
  const next = nextConfig(config, change)
  if (!next.succeeded) return next
  return parseConfig(JSON.stringify(next.output), platform)
}

export function parseSettingNumber(text: string, kind: SettingNumberKind): SettingNumberResult {
  const trimmed = text.trim()
  if (kind === "threshold") return parseThreshold(trimmed)
  return parseCount(trimmed)
}

function parseThreshold(text: string): SettingNumberResult {
  const value = Number(text)
  if (!THRESHOLD_TEXT.test(text) || value > 1) return { succeeded: false, problems: [THRESHOLD_REASON] }
  return { succeeded: true, output: value }
}

function parseCount(text: string): SettingNumberResult {
  const value = Number(text)
  if (!COUNT_TEXT.test(text) || !Number.isSafeInteger(value) || value < 1) {
    return { succeeded: false, problems: [COUNT_REASON] }
  }
  return { succeeded: true, output: value }
}

function nextConfig(config: MemoryConfig, change: SettingChange): NextConfig {
  switch (change.kind) {
    case "agentModel":
      return done({ ...config, memoryAgent: { model: change.model } })
    case "observerModel":
    case "thinking":
    case "observerCount":
      return done({ ...config, observer: withObserver(config.observer, change) })
    case "compactionCount":
      return done({ ...config, compaction: { ...config.compaction, [change.name]: change.value } })
    case "embeddings":
      return done({ ...config, embeddings: change.embeddings })
    case "budgetChars":
      return done({ ...config, context: { budgetChars: change.value } })
    case "limit":
      return done({ ...config, limits: { ...config.limits, [change.name]: change.value } })
    case "decision":
      return done(withDecision(config, change))
    case "gateThreshold":
    case "relevanceThreshold":
      return done(withThreshold(config, change))
    case "projectVault":
      return withProjects(config, change.name, (project) => ({ ...project, vault: change.vault }))
    case "removeProject":
      return withProjects(config, change.name, () => null)
  }
}

function done(output: ConfigCandidate): NextConfig {
  return { succeeded: true, output }
}

function withObserver(
  observer: MemoryConfig["observer"],
  change: ObserverModelChange | ThinkingChange | ObserverCountChange,
): MemoryConfig["observer"] {
  if (change.kind === "observerModel") return { ...observer, model: change.model }
  if (change.kind === "thinking") return { ...observer, thinking: change.value }
  return { ...observer, [change.name]: change.value }
}

function withDecision(config: MemoryConfig, change: DecisionChange): ConfigCandidate {
  const current = config.decisionModel
  if (change.provider === "typesafe") {
    if (current.provider === "typesafe") return config
    return { ...config, decisionModel: { provider: "typesafe", model: "jev-latest" } }
  }
  if (current.provider === "laya") return { ...config, decisionModel: { ...current, endpoint: change.endpoint } }
  return { ...config, decisionModel: repairDecision({ provider: "laya", endpoint: change.endpoint }) }
}

function withThreshold(config: MemoryConfig, change: ThresholdChange): ConfigCandidate {
  let threshold: number | undefined
  if (typeof change.value === "number") threshold = change.value
  return { ...config, decisionModel: { ...config.decisionModel, [change.kind]: threshold } }
}

function withProjects(config: MemoryConfig, name: string, replace: ProjectReplacement): NextConfig {
  if (!config.projects.some((project) => project.name === name)) {
    return { succeeded: false, problems: [`No project named "${name}"`] }
  }
  const projects: MemoryConfig["projects"] = []
  for (const project of config.projects) {
    if (project.name !== name) {
      projects.push(project)
      continue
    }
    const replacement = replace(project)
    if (replacement) projects.push(replacement)
  }
  return done({ ...config, projects })
}
