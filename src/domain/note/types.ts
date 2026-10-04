import type { Static } from "typebox"

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

export type ParseNoteResult = { succeeded: true; output: Note } | { succeeded: false; problems: string[] }

export interface NoteParts {
  frontmatter: string
  body: string
}

export type SplitNoteResult = { succeeded: true; output: NoteParts } | { succeeded: false; problems: string[] }

export type ReadFrontmatterResult =
  | { succeeded: true; output: NoteFrontmatter }
  | { succeeded: false; problems: string[] }
