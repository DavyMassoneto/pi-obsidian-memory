import { Value } from "typebox/value"
import { parseDocument } from "yaml"

import { describeSchemaErrors } from "#/domain/validation"
import { FRONTMATTER_FENCE } from "./constants.ts"
import { NoteFrontmatterSchema } from "./schemas.ts"
import type { ParseNoteResult, ReadFrontmatterResult, SplitNoteResult } from "./types.ts"

export function parseNote(statement: string, text: string): ParseNoteResult {
  const parts = splitNote(text)
  if (!parts.succeeded) {
    return parts
  }

  const frontmatter = readFrontmatter(parts.output.frontmatter)
  if (!frontmatter.succeeded) {
    return frontmatter
  }

  return {
    succeeded: true,
    output: { statement, frontmatter: frontmatter.output, body: parts.output.body },
  }
}

function splitNote(text: string): SplitNoteResult {
  const lines = text.replaceAll("\r\n", "\n").split("\n")

  if (lines[0] !== FRONTMATTER_FENCE) {
    return { succeeded: false, problems: ["missing frontmatter"] }
  }

  const closingFence = lines.indexOf(FRONTMATTER_FENCE, 1)
  if (closingFence < 0) {
    return { succeeded: false, problems: ["frontmatter is not closed"] }
  }

  const frontmatter = lines.slice(1, closingFence).join("\n")
  const body = lines
    .slice(closingFence + 1)
    .join("\n")
    .trim()

  return { succeeded: true, output: { frontmatter, body } }
}

function readFrontmatter(yaml: string): ReadFrontmatterResult {
  const document = parseDocument(yaml)
  if (document.errors.length > 0) {
    return { succeeded: false, problems: document.errors.map((error) => `frontmatter: ${error.message}`) }
  }

  const frontmatter = document.toJS()
  if (!Value.Check(NoteFrontmatterSchema, frontmatter)) {
    const errors = Value.Errors(NoteFrontmatterSchema, frontmatter)
    return { succeeded: false, problems: describeSchemaErrors(errors, "frontmatter") }
  }

  return { succeeded: true, output: frontmatter }
}
