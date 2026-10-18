import { COUNT_REASON, COUNT_TEXT, THRESHOLD_REASON, THRESHOLD_TEXT } from "./constants.ts"
import { parseConfig } from "./parse.ts"
import { repairDecision } from "./resources.ts"
import type {
  ConfigCandidate,
  DecisionChange,
  MemoryConfig,
  NextConfig,
  ParseConfigResult,
  ProjectReplacement,
  SettingChange,
  SettingNumberKind,
  SettingNumberResult,
  ThresholdChange,
} from "./types.ts"

export function changeSetting(config: MemoryConfig, change: SettingChange): ParseConfigResult {
  const next = nextConfig(config, change)
  if (!next.succeeded) return next
  return parseConfig(JSON.stringify(next.output))
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
    case "captureModel":
      return done({ ...config, capture: { ...config.capture, model: change.model } })
    case "agentModel":
      return done({ ...config, memoryAgent: { model: change.model } })
    case "captureCount":
    case "captureSwitch":
      return done({ ...config, capture: { ...config.capture, [change.name]: change.value } })
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
