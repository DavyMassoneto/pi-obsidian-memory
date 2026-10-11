import Type from "typebox"

import {
  CatalogEntrySchema,
  CatalogPathSchema,
  CatalogStatSchema,
  NoteIdSchema,
  NoteTypeSchema,
  VectorGenerationSchema,
} from "#/domain"

export const SearchHitSchema = Type.Object(
  {
    id: NoteIdSchema,
    folder: Type.String(),
    statement: Type.String(),
    type: NoteTypeSchema,
    score: Type.Number(),
  },
  { additionalProperties: false },
)

export const IndexEntrySchema = Type.Object(
  {
    id: NoteIdSchema,
    folder: Type.String(),
    statement: Type.String(),
    body: Type.String(),
    type: NoteTypeSchema,
    dontForget: Type.Boolean(),
    archived: Type.Boolean(),
    size: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    modifiedMs: Type.Number(),
    hash: Type.String(),
  },
  { additionalProperties: false },
)

export const CatalogStateSchema = Type.Object(
  {
    revision: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    population: Type.Union([Type.Literal("ready"), Type.Literal("needs-population")]),
  },
  { additionalProperties: false },
)

export const CatalogChangesSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    upserts: Type.Array(CatalogEntrySchema),
    deletes: Type.Array(CatalogPathSchema),
    statUpdates: Type.Array(
      Type.Object({ path: CatalogPathSchema, stat: CatalogStatSchema }, { additionalProperties: false }),
    ),
    population: Type.Union([Type.Literal("ready"), Type.Literal("needs-population")]),
  },
  { additionalProperties: false },
)

export const CatalogRowSchema = Type.Object(
  {
    path: CatalogPathSchema,
    id: Type.Union([NoteIdSchema, Type.Null()]),
    type: Type.Union([NoteTypeSchema, Type.Null()]),
    statement: Type.Union([Type.String(), Type.Null()]),
    body: Type.Union([Type.String(), Type.Null()]),
    dont_forget: Type.Union([Type.Literal(0), Type.Literal(1), Type.Null()]),
    archived: Type.Union([Type.Literal(0), Type.Literal(1), Type.Null()]),
    size: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    modified_ms: Type.Number(),
    hash: Type.String({ minLength: 1 }),
    content_fingerprint: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    validation_fingerprint: Type.String({ minLength: 1 }),
    needs_fixing: Type.Union([Type.Literal(0), Type.Literal(1)]),
  },
  { additionalProperties: false },
)

export const CatalogHitSchema = Type.Object(
  {
    path: CatalogPathSchema,
    id: NoteIdSchema,
    type: NoteTypeSchema,
    statement: Type.String(),
    dontForget: Type.Boolean(),
    needsFixing: Type.Boolean(),
    score: Type.Number(),
  },
  { additionalProperties: false },
)

export const CatalogHitRowSchema = Type.Object(
  {
    path: CatalogPathSchema,
    id: NoteIdSchema,
    type: NoteTypeSchema,
    statement: Type.String(),
    dont_forget: Type.Union([Type.Literal(0), Type.Literal(1)]),
    needs_fixing: Type.Union([Type.Literal(0), Type.Literal(1)]),
    score: Type.Number(),
  },
  { additionalProperties: false },
)

export const VectorValuesSchema = Type.Array(Type.Number(), { minItems: 1 })

export const VectorChunkSchema = Type.Object(
  {
    contentFingerprint: Type.String({ minLength: 1 }),
    chunk: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    vector: VectorValuesSchema,
  },
  { additionalProperties: false },
)

export const VectorReplacementSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    generation: VectorGenerationSchema,
    chunks: Type.Array(VectorChunkSchema),
  },
  { additionalProperties: false },
)

export const VectorRowSchema = Type.Object(
  {
    content_fingerprint: Type.String({ minLength: 1 }),
    chunk: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    vector: Type.String(),
  },
  { additionalProperties: false },
)

export const SearchOptionsSchema = Type.Object(
  {
    limit: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
    includeArchived: Type.Boolean(),
  },
  { additionalProperties: false },
)
