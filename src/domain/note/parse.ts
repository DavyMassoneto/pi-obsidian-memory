import { FRONTMATTER_FENCE, LINE_BREAK } from "./constants.ts"
import type { ParseNoteResult } from "./types.ts"

export function parseNote(statement: string, text: string): ParseNoteResult {
  const lines = text.replaceAll("\r\n", LINE_BREAK).split(LINE_BREAK)

  if (lines[0] !== FRONTMATTER_FENCE) {
    return { succeeded: false, problems: ["missing frontmatter"] }
  }

  const closingFence = lines.indexOf(FRONTMATTER_FENCE, 1)
  if (closingFence < 0) {
    return { succeeded: false, problems: ["frontmatter is not closed"] }
  }

  const frontmatter = lines.slice(1, closingFence).join(LINE_BREAK)
  const afterFrontmatter = lines.slice(closingFence + 1).join(LINE_BREAK)

  return { succeeded: true, output: { statement, frontmatter, body: withoutFraming(afterFrontmatter) } }
}

function withoutFraming(text: string): string {
  const withoutBlankLine = withoutPrefix(text, LINE_BREAK)
  return withoutSuffix(withoutBlankLine, LINE_BREAK)
}

function withoutPrefix(text: string, prefix: string): string {
  if (text.startsWith(prefix)) {
    return text.slice(prefix.length)
  }

  return text
}

function withoutSuffix(text: string, suffix: string): string {
  if (text.endsWith(suffix)) {
    return text.slice(0, -suffix.length)
  }

  return text
}
