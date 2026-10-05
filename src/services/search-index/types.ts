import type { DatabaseSync } from "node:sqlite"

import type { Static } from "typebox"

import type { NoteType } from "#/domain"
import type { SearchHitSchema } from "./schemas.ts"

export type SearchIndex = DatabaseSync

export type SearchHit = Static<typeof SearchHitSchema>

export interface IndexEntry {
  id: string
  folder: string
  statement: string
  body: string
  type: NoteType
  dontForget: boolean
  archived: boolean
  size: number
  modifiedMs: number
  hash: string
}

export interface SearchOptions {
  limit: number
  includeArchived: boolean
}

export type IndexWork = () => void
