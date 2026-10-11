import { NoteFrontmatterSchema } from "./schemas.ts"

export const FRONTMATTER_FENCE = "---"

export const LINE_BREAK = "\n"

export const REPEATED_FIELD_ERROR_CODE = "DUPLICATE_KEY"

export const KNOWN_FRONTMATTER_FIELDS = Object.keys(NoteFrontmatterSchema.properties)

export const NOT_FIELDS_PROBLEM = "frontmatter: must be fields (name: value)"

export const NAME_NOT_TEXT_PROBLEM = "frontmatter: a field name is not text"

export const NOTE_CHARACTER_SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" })
