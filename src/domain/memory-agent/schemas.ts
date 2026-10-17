import Type from "typebox"

import { NoteIdSchema, NoteTypeSchema } from "#src/domain/note"

export const VaultSchema = Type.Enum(["global", "project"])
export const PathSchema = Type.String()
export const TextSchema = Type.String({ minLength: 1 })
export const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" })

export const IdentitySchema = Type.Object(
  { vault: VaultSchema, path: PathSchema, id: NoteIdSchema, hash: HashSchema },
  { additionalProperties: false },
)

export const CandidateSchema = Type.Object(
  { vault: VaultSchema, path: PathSchema, id: NoteIdSchema, statement: TextSchema, snippet: TextSchema },
  { additionalProperties: false },
)

export const ListedNoteSchema = Type.Object(
  {
    vault: VaultSchema,
    path: PathSchema,
    type: NoteTypeSchema,
    statement: TextSchema,
    dontForget: Type.Optional(Type.Boolean()),
  },
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
    { kind: Type.Literal("search"), query: TextSchema, candidates: Type.Array(CandidateSchema) },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("listing"),
      vault: VaultSchema,
      folder: PathSchema,
      folders: Type.Array(PathSchema),
      notes: Type.Array(ListedNoteSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("unavailable"), operation: Type.Enum(["search", "get", "list"]), detail: TextSchema },
    { additionalProperties: false },
  ),
])

export const RetrievalRefusedSchema = Type.Object(
  {
    kind: Type.Literal("refused"),
    action: Type.Literal("unparseable"),
    problems: Type.Array(TextSchema),
  },
  { additionalProperties: false },
)

export const RetrievalObservationSchema = Type.Union([ObservationSchema, RetrievalRefusedSchema])

export const ReadActionSchema = Type.Union([
  Type.Object(
    {
      action: Type.Literal("search"),
      vault: VaultSchema,
      query: TextSchema,
      limit: Type.Integer({ minimum: 1 }),
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
  Type.Object({ action: Type.Literal("finish"), notes: Type.Array(IdentitySchema) }, { additionalProperties: false }),
])

export const AgentContextSchema = Type.Object(
  { project: Type.Union([TextSchema, Type.Null()]), folder: TextSchema },
  { additionalProperties: false },
)

export const RetrievalInputSchema = Type.Object(
  {
    context: AgentContextSchema,
    query: TextSchema,
    observations: Type.Array(RetrievalObservationSchema),
  },
  { additionalProperties: false },
)
