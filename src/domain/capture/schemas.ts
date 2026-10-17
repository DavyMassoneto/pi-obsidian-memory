import Type from "typebox"

import {
  AgentContextSchema,
  HashSchema,
  MAX_REFUSAL_PROBLEMS,
  ObservationSchema,
  PathSchema,
  ReadActionSchema,
  ReadObservationSchema,
  TextSchema,
  VaultSchema,
} from "#src/domain/memory-agent"
import { NoteIdSchema, NoteTypeSchema } from "#src/domain/note"
import { maxTranscriptItems } from "./constants.ts"

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

export const RefusedObservationSchema = Type.Object(
  {
    kind: Type.Literal("refused"),
    action: Type.Enum(["search", "get", "list", "add", "update", "archive", "succeed", "finish", "unparseable"]),
    problems: Type.Array(TextSchema, { maxItems: MAX_REFUSAL_PROBLEMS }),
  },
  { additionalProperties: false },
)

export const CaptureObservationSchema = Type.Union([
  ObservationSchema,
  WriteObservationSchema,
  RefusedObservationSchema,
])

export const CaptureInputSchema = Type.Object(
  {
    context: AgentContextSchema,
    transcriptDelta: Type.Array(
      Type.Object({ role: Type.Enum(["user", "assistant"]), text: TextSchema }, { additionalProperties: false }),
      { minItems: 1, maxItems: maxTranscriptItems },
    ),
    observations: Type.Array(CaptureObservationSchema),
    explicitSaves: Type.Array(ReadObservationSchema, { maxItems: 20 }),
    limits: Type.Object(
      { maxBodyChars: Type.Integer({ minimum: 1 }), maxStatementChars: Type.Integer({ minimum: 1 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)
