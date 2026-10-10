import { checkNoteText } from "./check.ts"
import { readFrontmatter } from "./frontmatter.ts"
import type { NoteLimits, ParsedNote, ValidateNoteResult } from "./types.ts"

export function validateNote(parsed: ParsedNote, limits: NoteLimits): ValidateNoteResult {
  const { statement, body } = parsed
  const frontmatter = readFrontmatter(parsed.frontmatter)
  const textProblems = checkNoteText(statement, body, limits)

  if (!frontmatter.succeeded) {
    return { succeeded: false, problems: [...frontmatter.problems, ...textProblems] }
  }

  if (textProblems.length > 0) {
    return { succeeded: false, problems: textProblems }
  }

  return { succeeded: true, output: { statement, frontmatter: frontmatter.output, body } }
}
