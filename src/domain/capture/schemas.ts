import Type from "typebox"

import {
  AgentContextSchema,
  HashSchema,
  ObservationSchema,
  PathSchema,
  ReadActionSchema,
  ReadObservationSchema,
  TextSchema,
  VaultSchema,
} from "#/domain/memory-agent"
import { NoteIdSchema, NoteTypeSchema } from "#/domain/note"

export const CaptureDraftSchema = Type.Object(
  { folder: PathSchema, statement: TextSchema, body: TextSchema, type: NoteTypeSchema, dontForget: Type.Boolean() },
  { additionalProperties: false },
)

export const CaptureActionSchema = Type.Union([
  ReadActionSchema,
  Type.Object(
    { action: Type.Literal("add"), vault: VaultSchema, note: CaptureDraftSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Enum(["update", "succeed"]),
      vault: VaultSchema,
      path: PathSchema,
      id: NoteIdSchema,
      expectedHash: HashSchema,
      note: CaptureDraftSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal("archive"),
      vault: VaultSchema,
      path: PathSchema,
      id: NoteIdSchema,
      expectedHash: HashSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object({ action: Type.Literal("clarify"), question: TextSchema }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("finish") }, { additionalProperties: false }),
])

export const WriteObservationSchema = Type.Object(
  {
    kind: Type.Literal("write"),
    operation: Type.Enum(["add", "update", "archive", "succeed"]),
    status: Type.Enum(["applied", "conflict", "refused"]),
    vault: VaultSchema,
    path: PathSchema,
    detail: TextSchema,
  },
  { additionalProperties: false },
)

export const CaptureObservationSchema = Type.Union([ObservationSchema, WriteObservationSchema])

export const CaptureInputSchema = Type.Object(
  {
    context: AgentContextSchema,
    transcriptDelta: Type.Array(
      Type.Object({ role: Type.Enum(["user", "assistant"]), text: TextSchema }, { additionalProperties: false }),
      { minItems: 1, maxItems: 100 },
    ),
    observations: Type.Array(CaptureObservationSchema, { maxItems: 20 }),
    explicitSaves: Type.Array(ReadObservationSchema, { maxItems: 20 }),
    limits: Type.Object(
      { maxBodyChars: Type.Integer({ minimum: 1 }), maxStatementChars: Type.Integer({ minimum: 1 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)
