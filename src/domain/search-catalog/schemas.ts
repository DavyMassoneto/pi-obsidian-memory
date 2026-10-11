import Type from "typebox"

import { NoteIdSchema, NoteTypeSchema } from "#/domain/note"

export const CatalogPathSchema = Type.String({
  minLength: 1,
  pattern: "^(?!/)(?!.*//)(?!.*(?:^|/)\\.{1,2}(?:/|$))[^\\\\:]+(?<!/)$",
})

export const CatalogStatSchema = Type.Object(
  {
    size: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    mtimeMs: Type.Number(),
  },
  { additionalProperties: false },
)

export const CatalogNoteSchema = Type.Object(
  {
    id: NoteIdSchema,
    type: NoteTypeSchema,
    statement: Type.String(),
    body: Type.String(),
    dontForget: Type.Boolean(),
    archived: Type.Boolean(),
  },
  { additionalProperties: false },
)

export const CatalogEntrySchema = Type.Object(
  {
    path: CatalogPathSchema,
    stat: CatalogStatSchema,
    rawHash: Type.String({ minLength: 1 }),
    contentFingerprint: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    validationFingerprint: Type.String({ minLength: 1 }),
    note: Type.Union([CatalogNoteSchema, Type.Null()]),
    needsFixing: Type.Boolean(),
  },
  { additionalProperties: false },
)

export const VectorGenerationSchema = Type.Object(
  {
    fingerprint: Type.String({ minLength: 1 }),
    dimensions: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
  },
  { additionalProperties: false },
)
