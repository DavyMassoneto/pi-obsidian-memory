import Type from "typebox"

import { EmbeddingConfigurationSchema } from "#src/domain/embeddings"

export const ConfigPathSchema = Type.String({
  pattern: "^(?:[A-Za-z]:[/\\\\]|/(?!/)|[/\\\\]{2}[^/\\\\]+[/\\\\][^/\\\\]+)",
})

export const ProjectNameSchema = Type.String({ minLength: 1, pattern: "\\S" })
export const ConfigLimitSchema = Type.Integer({ minimum: 1 })
export const ChatModelPartSchema = Type.String({ minLength: 1, pattern: "\\S" })
export const ChatModelReferenceSchema = Type.Object(
  { provider: ChatModelPartSchema, id: ChatModelPartSchema },
  { additionalProperties: false },
)
export const CaptureWhenSchema = Type.Union([
  Type.Literal("after-each-turn"),
  Type.Literal("on-compaction"),
  Type.Literal("at-session-end"),
])
export const LegacyCaptureSchema = Type.Object({ capture: Type.Object({ when: CaptureWhenSchema }) })
export const LayaMaxTokensSchema = Type.Integer({ minimum: 1, maximum: 8192 })
export const LayaHeadMaxTokensSchema = Type.Integer({ minimum: 1, maximum: 8191 })
export const DecisionThresholdSchema = Type.Number({ minimum: 0, maximum: 1 })
export const LayaConfigurationSchema = Type.Object(
  {
    provider: Type.Literal("laya"),
    endpoint: Type.String(),
    model: Type.Literal("multilingual"),
    maxTokens: LayaMaxTokensSchema,
    headMaxTokens: LayaHeadMaxTokensSchema,
    gateThreshold: Type.Optional(DecisionThresholdSchema),
    relevanceThreshold: Type.Optional(DecisionThresholdSchema),
  },
  { additionalProperties: false },
)
export const JevConfigurationSchema = Type.Object(
  {
    provider: Type.Literal("typesafe"),
    model: Type.Literal("jev-latest"),
    gateThreshold: Type.Optional(DecisionThresholdSchema),
    relevanceThreshold: Type.Optional(DecisionThresholdSchema),
  },
  { additionalProperties: false },
)
export const DecisionConfigurationSchema = Type.Union([LayaConfigurationSchema, JevConfigurationSchema])
export const ConfigObjectSchema = Type.Object({}, { additionalProperties: true })
export const EmbeddingSelectionSchema = Type.Object({
  provider: Type.Index(EmbeddingConfigurationSchema, ["provider"]),
  model: Type.Index(EmbeddingConfigurationSchema, ["model"]),
})
export const DecisionSelectionSchema = Type.Object({
  provider: Type.Index(DecisionConfigurationSchema, ["provider"]),
  model: Type.Index(DecisionConfigurationSchema, ["model"]),
  endpoint: Type.Optional(LayaConfigurationSchema.properties.endpoint),
  maxTokens: Type.Optional(LayaMaxTokensSchema),
  headMaxTokens: Type.Optional(LayaHeadMaxTokensSchema),
  gateThreshold: Type.Optional(DecisionThresholdSchema),
  relevanceThreshold: Type.Optional(DecisionThresholdSchema),
})

export const ConfigFieldObservationSchema = Type.Union([
  Type.Object({ field: Type.Literal("/global/vault"), index: Type.Integer(), value: ConfigPathSchema }),
  Type.Object({ field: Type.Literal("/projects/name"), index: Type.Integer(), value: ProjectNameSchema }),
  Type.Object({ field: Type.Literal("/projects/folder"), index: Type.Integer(), value: ConfigPathSchema }),
  Type.Object({ field: Type.Literal("/projects/vault"), index: Type.Integer(), value: ConfigPathSchema }),
  Type.Object({ field: Type.Literal("/limits/maxBodyChars"), index: Type.Integer(), value: ConfigLimitSchema }),
  Type.Object({ field: Type.Literal("/limits/maxStatementChars"), index: Type.Integer(), value: ConfigLimitSchema }),
  Type.Object({ field: Type.Literal("/limits/maxNotesPerFolder"), index: Type.Integer(), value: ConfigLimitSchema }),
  Type.Object({ field: Type.Literal("/context/budgetChars"), index: Type.Integer(), value: ConfigLimitSchema }),
  Type.Object({ field: Type.Literal("/capture/nudgeInterval"), index: Type.Integer(), value: ConfigLimitSchema }),
  Type.Object({ field: Type.Literal("/capture/nudgeToolCalls"), index: Type.Integer(), value: ConfigLimitSchema }),
  Type.Object({ field: Type.Literal("/capture/flushMinTurns"), index: Type.Integer(), value: ConfigLimitSchema }),
  Type.Object({ field: Type.Literal("/capture/reviewEnabled"), index: Type.Integer(), value: Type.Boolean() }),
  Type.Object({ field: Type.Literal("/capture/flushOnCompact"), index: Type.Integer(), value: Type.Boolean() }),
  Type.Object({ field: Type.Literal("/capture/flushOnShutdown"), index: Type.Integer(), value: Type.Boolean() }),
  Type.Object({ field: Type.Literal("/capture/model/provider"), index: Type.Integer(), value: ChatModelPartSchema }),
  Type.Object({ field: Type.Literal("/capture/model/id"), index: Type.Integer(), value: ChatModelPartSchema }),
  Type.Object({
    field: Type.Literal("/memoryAgent/model/provider"),
    index: Type.Integer(),
    value: ChatModelPartSchema,
  }),
  Type.Object({ field: Type.Literal("/memoryAgent/model/id"), index: Type.Integer(), value: ChatModelPartSchema }),
  Type.Object({
    field: Type.Literal("/embeddings/provider"),
    index: Type.Integer(),
    value: EmbeddingSelectionSchema.properties.provider,
  }),
  Type.Object({
    field: Type.Literal("/embeddings/model"),
    index: Type.Integer(),
    value: EmbeddingSelectionSchema.properties.model,
  }),
  Type.Object({
    field: Type.Literal("/decisionModel/provider"),
    index: Type.Integer(),
    value: DecisionSelectionSchema.properties.provider,
  }),
  Type.Object({
    field: Type.Literal("/decisionModel/model"),
    index: Type.Integer(),
    value: DecisionSelectionSchema.properties.model,
  }),
  Type.Object({ field: Type.Literal("/decisionModel/endpoint"), index: Type.Integer(), value: Type.String() }),
  Type.Object({ field: Type.Literal("/decisionModel/maxTokens"), index: Type.Integer(), value: LayaMaxTokensSchema }),
  Type.Object({
    field: Type.Literal("/decisionModel/headMaxTokens"),
    index: Type.Integer(),
    value: LayaHeadMaxTokensSchema,
  }),
  Type.Object({
    field: Type.Literal("/decisionModel/gateThreshold"),
    index: Type.Integer(),
    value: DecisionThresholdSchema,
  }),
  Type.Object({
    field: Type.Literal("/decisionModel/relevanceThreshold"),
    index: Type.Integer(),
    value: DecisionThresholdSchema,
  }),
])

export const ProjectEntrySchema = Type.Object(
  { name: ProjectNameSchema, folder: ConfigPathSchema, vault: ConfigPathSchema },
  { additionalProperties: false },
)

export const MemoryConfigSchema = Type.Object(
  {
    global: Type.Object({ vault: ConfigPathSchema }, { additionalProperties: false }),
    projects: Type.Array(ProjectEntrySchema),
    limits: Type.Object(
      { maxBodyChars: ConfigLimitSchema, maxStatementChars: ConfigLimitSchema, maxNotesPerFolder: ConfigLimitSchema },
      { additionalProperties: false },
    ),
    capture: Type.Object(
      {
        model: ChatModelReferenceSchema,
        nudgeInterval: ConfigLimitSchema,
        nudgeToolCalls: ConfigLimitSchema,
        flushMinTurns: ConfigLimitSchema,
        reviewEnabled: Type.Boolean(),
        flushOnCompact: Type.Boolean(),
        flushOnShutdown: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
    memoryAgent: Type.Object({ model: ChatModelReferenceSchema }, { additionalProperties: false }),
    context: Type.Object({ budgetChars: ConfigLimitSchema }, { additionalProperties: false }),
    embeddings: EmbeddingConfigurationSchema,
    decisionModel: DecisionConfigurationSchema,
  },
  { additionalProperties: false },
)
