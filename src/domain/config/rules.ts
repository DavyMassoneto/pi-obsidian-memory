import type { TObject } from "typebox"

import { EmbeddingConfigurationSchema } from "#src/domain/embeddings"
import {
  DecisionSelectionSchema,
  EmbeddingSelectionSchema,
  JevConfigurationSchema,
  LayaConfigurationSchema,
  MemoryConfigSchema,
  ProjectEntrySchema,
} from "./schemas.ts"
import type { ConfigFieldRule, ConfigRuleSelection } from "./types.ts"

export function configRules(selection: ConfigRuleSelection): ConfigFieldRule[] {
  const properties = MemoryConfigSchema.properties
  const keys = Object.keys(properties)
  const rules: ConfigFieldRule[] = [{ kind: "object", path: "", keys, required: keys }]
  rules.push(...objectRules("/global", properties.global), ...objectRules("/limits", properties.limits))
  rules.push(...objectRules("/capture", properties.capture), ...objectRules("/memoryAgent", properties.memoryAgent))
  rules.push(...objectRules("/context", properties.context))
  for (let index = 0; index < selection.projectCount; index++) {
    rules.push(...objectRules(`/projects/${index}`, ProjectEntrySchema))
  }
  let embeddings: TObject = EmbeddingSelectionSchema
  for (const schema of EmbeddingConfigurationSchema.anyOf) {
    if (schema.properties.provider.const === selection.embeddings) embeddings = schema
  }
  rules.push(...objectRules("/embeddings", embeddings))
  if (selection.decisionModel === "laya") rules.push(...objectRules("/decisionModel", LayaConfigurationSchema))
  else if (selection.decisionModel === "typesafe") rules.push(...objectRules("/decisionModel", JevConfigurationSchema))
  else rules.push(...objectRules("/decisionModel", DecisionSelectionSchema))
  return rules
}

function objectRules(path: string, schema: TObject): ConfigFieldRule[] {
  let required: string[] = []
  if (Array.isArray(schema.required)) required = schema.required
  const rules: ConfigFieldRule[] = [{ kind: "object", path, keys: Object.keys(schema.properties), required }]
  for (const [key, property] of Object.entries(schema.properties)) {
    if (path === "/capture" && key === "model") {
      rules.push(...objectRules(`${path}/model`, MemoryConfigSchema.properties.capture.properties.model))
    } else if (path === "/memoryAgent" && key === "model") {
      rules.push(...objectRules(`${path}/model`, MemoryConfigSchema.properties.memoryAgent.properties.model))
    } else {
      rules.push({ kind: "value", path: `${path}/${key}`, schema: property })
    }
  }
  return rules
}
