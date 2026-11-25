import Type from "typebox"

export const ObservationIdSchema = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?$" })

export const ObservationOriginSchema = Type.Enum([
  "user",
  "restated",
  "partial",
  "material",
  "mention",
  "unconfirmed",
  "unverified",
])

export const SourceEntryIdsSchema = Type.Array(Type.String({ minLength: 1 }))

export const ChangedNoteSchema = Type.Object(
  { vault: Type.Enum(["global", "project"]), path: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
)

export const WorkStateItemSchema = Type.Object(
  { sourceId: ObservationIdSchema, text: Type.String({ pattern: "^\\S[^\\r\\n]*$" }) },
  { additionalProperties: false },
)

export const ConsolidationMetaSchema = Type.Object(
  {
    observationIds: Type.Array(ObservationIdSchema),
    journey: Type.Optional(Type.String()),
    workState: Type.Optional(Type.Array(WorkStateItemSchema)),
    materialIds: Type.Optional(Type.Array(ObservationIdSchema)),
    notes: Type.Optional(Type.Array(ChangedNoteSchema)),
  },
  { additionalProperties: false },
)

export const NoteWrittenSchema = Type.Object(
  {
    observationIds: Type.Array(ObservationIdSchema),
    vault: Type.Enum(["global", "project"]),
    path: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
)

export const RectifyFailedSchema = Type.Object(
  { recordId: Type.String({ minLength: 1 }), problem: Type.String() },
  { additionalProperties: false },
)

export const UserPassageSchema = Type.Object(
  {
    kind: Type.Enum(["request", "restriction", "authorization", "goal", "message"]),
    quote: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
)

export const UserWordsSchema = Type.Object(
  { entryId: Type.String({ minLength: 1 }), passages: Type.Array(UserPassageSchema) },
  { additionalProperties: false },
)

export const UserWordsReplySchema = Type.Object(
  { passages: Type.Array(UserPassageSchema) },
  { additionalProperties: false },
)

export const RectifiedObservationSchema = Type.Object(
  {
    id: ObservationIdSchema,
    origin: Type.Enum(["user", "restated", "partial", "material", "mention", "unconfirmed"]),
    quotes: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    supportedBy: Type.Optional(Type.String({ minLength: 1 })),
    quote: Type.Optional(Type.String({ minLength: 1 })),
    content: Type.Optional(Type.String({ minLength: 1, pattern: "^[^\\r\\n]+$" })),
    sourceId: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
)

export const ObservationsRectifiedSchema = Type.Object(
  {
    recordId: Type.String({ minLength: 1 }),
    fromId: Type.String({ minLength: 1 }),
    coversUpToId: Type.String({ minLength: 1 }),
    userEntryIds: SourceEntryIdsSchema,
    observations: Type.Array(RectifiedObservationSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
)

export const AttributionVerdictSchema = Type.Object(
  {
    id: ObservationIdSchema,
    actor: Type.Enum(["user", "assistant", "other", "none", "unknown"]),
    partial: Type.Boolean(),
    supportedBy: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    quote: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    moreQuotes: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
)

export const AttributionReplySchema = Type.Object(
  { verdicts: Type.Array(AttributionVerdictSchema) },
  { additionalProperties: false },
)

export const RepairSchema = Type.Object(
  {
    id: ObservationIdSchema,
    sourceId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    quote: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    content: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
)

export const RepairReplySchema = Type.Object({ repairs: Type.Array(RepairSchema) }, { additionalProperties: false })
