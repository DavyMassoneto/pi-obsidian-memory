import { isLoopbackEndpoint } from "#/domain/decision-model"
import { ConfigFieldObservationSchema } from "./schemas.ts"
import type {
  ConfigDocumentInspection,
  ConfigFieldObservation,
  ConfigFields,
  ConfigObservationRule,
  ConfigRuleSelection,
  DecisionFields,
  EmbeddingFields,
} from "./types.ts"

export function configObservationRules(projectCount: number): ConfigObservationRule[] {
  const rules: ConfigObservationRule[] = []
  for (const schema of ConfigFieldObservationSchema.anyOf) {
    const field = schema.properties.field.const
    if (field.startsWith("/projects/")) {
      for (let index = 0; index < projectCount; index++) {
        rules.push({ field, index, path: field.replace("/projects/", `/projects/${index}/`) })
      }
    } else rules.push({ field, index: 0, path: field })
  }
  return rules
}

export function configRuleSelection(projectCount: number, observations: ConfigFieldObservation[]): ConfigRuleSelection {
  const selection: ConfigRuleSelection = { projectCount, embeddings: null, decisionModel: null }
  for (const observation of observations) {
    if (observation.field === "/embeddings/provider") selection.embeddings = observation.value
    if (observation.field === "/decisionModel/provider") selection.decisionModel = observation.value
  }
  return selection
}

export function observedConfigFields(inspection: ConfigDocumentInspection): ConfigFields {
  const fields: ConfigFields = {
    global: {},
    projects: Array.from({ length: inspection.projectCount }, () => ({})),
    limits: {},
    context: {},
    capture: { model: {} },
    memoryAgent: { model: {} },
    embeddings: observedEmbeddingFields(inspection.observations),
    decisionModel: observedDecisionFields(inspection.observations),
  }
  for (const observation of inspection.observations) {
    retainRegistrationField(fields, observation)
    retainSettingField(fields, observation)
  }
  return fields
}

function retainRegistrationField(fields: ConfigFields, observation: ConfigFieldObservation): void {
  if (observation.field === "/global/vault") fields.global.vault = observation.value
  const project = fields.projects[observation.index]
  if (!project) return
  if (observation.field === "/projects/name") project.name = observation.value
  if (observation.field === "/projects/folder") project.folder = observation.value
  if (observation.field === "/projects/vault") project.vault = observation.value
}

function retainSettingField(fields: ConfigFields, observation: ConfigFieldObservation): void {
  if (observation.field === "/limits/maxBodyChars") fields.limits.maxBodyChars = observation.value
  if (observation.field === "/limits/maxStatementChars") fields.limits.maxStatementChars = observation.value
  if (observation.field === "/limits/maxNotesPerFolder") fields.limits.maxNotesPerFolder = observation.value
  if (observation.field === "/context/budgetChars") fields.context.budgetChars = observation.value
  if (observation.field === "/capture/when") fields.capture.when = observation.value
  if (observation.field === "/capture/model/provider") fields.capture.model.provider = observation.value
  if (observation.field === "/capture/model/id") fields.capture.model.id = observation.value
  if (observation.field === "/memoryAgent/model/provider") fields.memoryAgent.model.provider = observation.value
  if (observation.field === "/memoryAgent/model/id") fields.memoryAgent.model.id = observation.value
}

export function observedEmbeddingFields(observations: ConfigFieldObservation[]): EmbeddingFields {
  const fields: EmbeddingFields = {}
  for (const observation of observations) {
    if (observation.field === "/embeddings/provider") fields.provider = observation.value
    if (observation.field === "/embeddings/model") fields.model = observation.value
  }
  return fields
}

export function observedDecisionFields(observations: ConfigFieldObservation[]): DecisionFields {
  const fields: DecisionFields = {}
  for (const observation of observations) {
    if (observation.field === "/decisionModel/provider") fields.provider = observation.value
    if (observation.field === "/decisionModel/model") fields.model = observation.value
  }
  if (fields.provider === "typesafe") return fields
  for (const observation of observations) {
    if (observation.field === "/decisionModel/endpoint" && isLoopbackEndpoint(observation.value)) {
      fields.endpoint = observation.value
    }
    if (observation.field === "/decisionModel/maxTokens") fields.maxTokens = observation.value
    if (observation.field === "/decisionModel/headMaxTokens") fields.headMaxTokens = observation.value
  }
  return fields
}
