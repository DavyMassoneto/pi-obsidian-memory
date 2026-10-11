import Type from "typebox"

import { NoteIdSchema, NoteTypeSchema } from "#/domain/note"

export const VaultSchema = Type.Enum(["global", "project"])
export const PathSchema = Type.String({ maxLength: 1024 })
export const TextSchema = Type.String({ minLength: 1, maxLength: 16000 })
export const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" })

export const IdentitySchema = Type.Object(
  { vault: VaultSchema, path: PathSchema, id: NoteIdSchema, hash: HashSchema },
  { additionalProperties: false },
)

export const CandidateSchema = Type.Object(
  { vault: VaultSchema, path: PathSchema, id: NoteIdSchema, statement: TextSchema, snippet: TextSchema },
  { additionalProperties: false },
)

export const ReadObservationSchema = Type.Object(
  {
    kind: Type.Literal("read"),
    vault: VaultSchema,
    path: PathSchema,
    id: NoteIdSchema,
    hash: HashSchema,
    statement: TextSchema,
    body: TextSchema,
    type: NoteTypeSchema,
    dontForget: Type.Boolean(),
  },
  { additionalProperties: false },
)

export const ObservationSchema = Type.Union([
  ReadObservationSchema,
  Type.Object(
    { kind: Type.Literal("search"), query: TextSchema, candidates: Type.Array(CandidateSchema, { maxItems: 20 }) },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("listing"),
      vault: VaultSchema,
      folder: PathSchema,
      folders: Type.Array(PathSchema, { maxItems: 20 }),
      notes: Type.Array(CandidateSchema, { maxItems: 20 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("unavailable"), operation: Type.Enum(["search", "get", "list"]), detail: TextSchema },
    { additionalProperties: false },
  ),
])

export const ReadActionSchema = Type.Union([
  Type.Object(
    {
      action: Type.Literal("search"),
      vault: VaultSchema,
      query: TextSchema,
      limit: Type.Integer({ minimum: 1, maximum: 20 }),
    },
    { additionalProperties: false },
  ),
  Type.Object({ action: Type.Literal("get"), vault: VaultSchema, path: PathSchema }, { additionalProperties: false }),
  Type.Object(
    { action: Type.Literal("list"), vault: VaultSchema, folder: PathSchema },
    { additionalProperties: false },
  ),
])

export const RetrievalActionSchema = Type.Union([
  ReadActionSchema,
  Type.Object(
    { action: Type.Literal("finish"), notes: Type.Array(IdentitySchema, { maxItems: 20 }) },
    { additionalProperties: false },
  ),
])

export const AgentContextSchema = Type.Object(
  { project: Type.Union([TextSchema, Type.Null()]), folder: TextSchema },
  { additionalProperties: false },
)

export const RetrievalInputSchema = Type.Object(
  { context: AgentContextSchema, query: TextSchema, observations: Type.Array(ObservationSchema, { maxItems: 20 }) },
  { additionalProperties: false },
)
