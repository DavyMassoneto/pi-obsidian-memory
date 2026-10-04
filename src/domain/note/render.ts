import { stringify } from "yaml"

import { FRONTMATTER_FENCE } from "./constants.ts"
import type { Note, NoteFrontmatter } from "./types.ts"

export function renderNote(note: Note): string {
  const frontmatter = stringify(orderedFrontmatter(note.frontmatter)).trimEnd()

  return [FRONTMATTER_FENCE, frontmatter, FRONTMATTER_FENCE, "", note.body, ""].join("\n")
}

function orderedFrontmatter(frontmatter: NoteFrontmatter): NoteFrontmatter {
  const ordered: NoteFrontmatter = {
    id: frontmatter.id,
    type: frontmatter.type,
    created: frontmatter.created,
    updated: frontmatter.updated,
  }

  if (frontmatter.dontForget) {
    ordered.dontForget = frontmatter.dontForget
  }

  if (frontmatter.archived) {
    ordered.archived = frontmatter.archived
  }

  if (frontmatter.replaces) {
    ordered.replaces = frontmatter.replaces
  }

  if (frontmatter.replacedBy) {
    ordered.replacedBy = frontmatter.replacedBy
  }

  return ordered
}
