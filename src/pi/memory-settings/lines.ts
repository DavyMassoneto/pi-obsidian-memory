import type { CutoffValue, MemoryConfig } from "#src/usecases"
import { resolveCutoffs } from "#src/usecases"
import { AGENT_MODEL_TITLE, OBSERVER_MODEL_TITLE, OBSERVER_THINKING_TITLE } from "./constants.ts"
import { modelEdit, numberEdit, thinkingEdit } from "./edits.ts"
import { projectsEdit } from "./projects.ts"
import { decisionEdit, embeddingsEdit } from "./providers.ts"
import type { NumberChange, SettingLine } from "./types.ts"

function cutoffText(cutoff: CutoffValue): string {
  if (typeof cutoff.value !== "number") return "not set"
  if (cutoff.source === "config") return `${cutoff.value} (set)`
  return `${cutoff.value} (TypeSafe starting value)`
}

function decisionText(config: MemoryConfig): string {
  const { decisionModel } = config
  if (decisionModel.provider === "laya") return `Laya (${decisionModel.endpoint})`
  return "Jev (TypeSafe)"
}

function cutoffLine(label: string, which: "gate" | "relevance", config: MemoryConfig): SettingLine {
  const cutoff = resolveCutoffs(config.decisionModel)[which]
  const title = `${label}, 0 to 1 (currently ${cutoffText(cutoff)}; type none to clear it; empty keeps it)`
  const kind = `${which}Threshold` as const
  return {
    label: `${label}: ${cutoffText(cutoff)}`,
    edit: numberEdit({
      title,
      what: label.toLowerCase(),
      kind: "threshold",
      current: cutoffText(cutoff),
      change: (value) => ({ kind, value }),
      clear: { kind, value: null },
    }),
  }
}

function countLine(label: string, unit: string, current: number, change: NumberChange): SettingLine {
  return {
    label: `${label}: ${current}${unit}`,
    edit: numberEdit({
      title: `${label} (a whole number of 1 or more; currently ${current}; empty keeps it)`,
      what: label.toLowerCase(),
      kind: "count",
      current: String(current),
      change,
      clear: null,
    }),
  }
}

function observerLines(config: MemoryConfig): SettingLine[] {
  const { observer } = config
  return [
    {
      label: `Observer model: ${observer.model.provider}/${observer.model.id}`,
      edit: modelEdit({
        title: OBSERVER_MODEL_TITLE,
        what: "observer model",
        kind: "observerModel",
        current: observer.model,
      }),
    },
    {
      label: `Observer thinking: ${observer.thinking}`,
      edit: thinkingEdit({ title: OBSERVER_THINKING_TITLE, what: "observer thinking", current: observer.thinking }),
    },
    countLine("Observe every", " tokens", observer.chunkTokens, (value) => ({
      kind: "observerCount",
      name: "chunkTokens",
      value,
    })),
    countLine("Observers at a time", "", observer.concurrency, (value) => ({
      kind: "observerCount",
      name: "concurrency",
      value,
    })),
  ]
}

function compactionLines(config: MemoryConfig): SettingLine[] {
  const { compaction } = config
  return [
    countLine("Compact at", " context tokens", compaction.atContextTokens, (value) => ({
      kind: "compactionCount",
      name: "atContextTokens",
      value,
    })),
    countLine("Verbatim tail", " tokens", compaction.tailTokens, (value) => ({
      kind: "compactionCount",
      name: "tailTokens",
      value,
    })),
    countLine("Memory map", " tokens", compaction.mapTokens, (value) => ({
      kind: "compactionCount",
      name: "mapTokens",
      value,
    })),
  ]
}

export function settingLines(config: MemoryConfig): SettingLine[] {
  const { limits } = config
  return [
    ...observerLines(config),
    ...compactionLines(config),
    {
      label: `Memory agent model: ${config.memoryAgent.model.provider}/${config.memoryAgent.model.id}`,
      edit: modelEdit({
        title: AGENT_MODEL_TITLE,
        what: "memory agent model",
        kind: "agentModel",
        current: config.memoryAgent.model,
      }),
    },
    { label: `Decision model: ${decisionText(config)}`, edit: decisionEdit },
    cutoffLine("Gate cutoff", "gate", config),
    cutoffLine("Relevance cutoff", "relevance", config),
    { label: `Embeddings: ${config.embeddings.provider} (${config.embeddings.model})`, edit: embeddingsEdit },
    countLine("Context budget", " characters", config.context.budgetChars, (value) => ({ kind: "budgetChars", value })),
    countLine("Max note body", " characters", limits.maxBodyChars, (value) => ({
      kind: "limit",
      name: "maxBodyChars",
      value,
    })),
    countLine("Max statement", " characters", limits.maxStatementChars, (value) => ({
      kind: "limit",
      name: "maxStatementChars",
      value,
    })),
    countLine("Max notes per folder", "", limits.maxNotesPerFolder, (value) => ({
      kind: "limit",
      name: "maxNotesPerFolder",
      value,
    })),
    { label: `Global vault: ${config.global.vault}`, edit: (env) => env.deps.changeGlobalVault(env.context) },
    { label: `Projects: ${config.projects.length}`, edit: projectsEdit },
  ]
}
