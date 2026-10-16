import { isLoopbackEndpoint } from "#src/domain/decision-model"
import { EmbeddingConfigurationSchema } from "#src/domain/embeddings"
import { readConfigInspection } from "./inspection.ts"
import { configRuleSelection, observedDecisionFields, observedEmbeddingFields } from "./observations.ts"
import type { ConfigDocumentInspection, DecisionFields, EmbeddingFields } from "./types.ts"

export function readEmbeddingFields(text: string): EmbeddingFields {
  return observedEmbeddingFields(readConfigInspection(text).observations)
}

export function readDecisionFields(text: string): DecisionFields {
  return observedDecisionFields(readConfigInspection(text).observations)
}

export function resourceProblems(text: string): string[] {
  return inspectedResourceProblems(readConfigInspection(text))
}

export function inspectedResourceProblems(inspection: ConfigDocumentInspection): string[] {
  if (configRuleSelection(inspection.projectCount, inspection.observations).decisionModel === "typesafe") return []
  const problems: string[] = []
  for (const observation of inspection.observations) {
    if (observation.field === "/decisionModel/endpoint" && !isLoopbackEndpoint(observation.value)) {
      problems.push(
        "decisionModel.endpoint: must be a loopback HTTP(S) /v1/systemone URL without credentials, query or fragment",
      )
    }
  }
  if (inspection.invalidTokenOrder) {
    problems.push("decisionModel.headMaxTokens: must be less than decisionModel.maxTokens")
  }
  return problems
}

export function repairEmbeddings(fields: EmbeddingFields): EmbeddingFields {
  for (const schema of EmbeddingConfigurationSchema.anyOf) {
    if (fields.provider === schema.properties.provider.const) {
      return { model: schema.properties.model.const, ...fields }
    }
  }
  return { provider: "local", model: "Xenova/multilingual-e5-small", ...fields }
}

export function repairDecision(fields: DecisionFields): DecisionFields {
  if (fields.provider === "typesafe") return { model: "jev-latest", ...fields }
  return {
    provider: "laya",
    endpoint: "http://127.0.0.1:8000/v1/systemone",
    model: "multilingual",
    maxTokens: 8192,
    headMaxTokens: 192,
    ...fields,
  }
}
