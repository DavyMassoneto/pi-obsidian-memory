import { stringify } from "yaml"

import { FRONTMATTER_FENCE, KNOWN_FRONTMATTER_FIELDS } from "./constants.ts"
import { NoteFrontmatterSchema } from "./schemas.ts"
import type { Note, NoteFrontmatter } from "./types.ts"

export function renderNote(note: Note): string {
  const frontmatter = stringify(orderedFrontmatter(note.frontmatter)).trimEnd()

  return [FRONTMATTER_FENCE, frontmatter, FRONTMATTER_FENCE, "", note.body, ""].join("\n")
}

function orderedFrontmatter(frontmatter: NoteFrontmatter): Map<keyof NoteFrontmatter, string | true> {
  const ordered = new Map<keyof NoteFrontmatter, string | true>()
  for (const name of KNOWN_FRONTMATTER_FIELDS.filter(isFrontmatterField)) {
    const value = frontmatter[name]
    if (typeof value === "string" || typeof value === "boolean") {
      ordered.set(name, value)
    }
  }

  return ordered
}

function isFrontmatterField(name: string): name is keyof NoteFrontmatter {
  return Object.hasOwn(NoteFrontmatterSchema.properties, name)
}
