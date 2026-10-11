import type { Static } from "typebox"
import type { Pair, ParsedNode } from "yaml"

import type { Absent, Failed, Succeeded } from "#/shared"
import type { NoteFrontmatterSchema, NoteTypeSchema } from "./schemas.ts"

export type NoteType = Static<typeof NoteTypeSchema>

export type NoteFrontmatter = Static<typeof NoteFrontmatterSchema>

export interface Note {
  statement: string
  frontmatter: NoteFrontmatter
  body: string
}

export interface NoteLimits {
  maxBodyChars: number
  maxStatementChars: number
}

export interface ParsedNote {
  statement: string
  frontmatter: string
  body: string
}

export type ParseNoteResult = Succeeded<ParsedNote> | Failed

export type ValidateNoteResult = Succeeded<Note> | Failed

export type ReadFrontmatterResult = Succeeded<NoteFrontmatter> | Failed

export type FieldResult<Value> = Succeeded<Value> | Failed

export type OptionalFieldResult<Value> = Succeeded<Value> | Failed | Absent

export type FieldNameResult = Succeeded<string> | Absent

export type FrontmatterPairs = Pair<ParsedNode, ParsedNode | null>[]

export type FieldReader<Value> = (node: ParsedNode | null) => FieldResult<Value>

export interface FrontmatterReadings {
  id: FieldResult<string>
  type: FieldResult<NoteType>
  created: FieldResult<string>
  updated: FieldResult<string>
  dontForget: OptionalFieldResult<true>
  archived: OptionalFieldResult<string>
  replaces: OptionalFieldResult<string>
  replacedBy: OptionalFieldResult<string>
}
