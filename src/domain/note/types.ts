import type { Static } from "typebox"

import type { Failed, Succeeded } from "#/shared"
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

export interface NoteParts {
  frontmatter: string
  body: string
}

export type ParseNoteResult = Succeeded<Note> | Failed

export type SplitNoteResult = Succeeded<NoteParts> | Failed

export type ReadFrontmatterResult = Succeeded<NoteFrontmatter> | Failed
