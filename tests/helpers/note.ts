import {
  type Note,
  type NoteType,
  type ParsedNote,
  parseNote,
  type ReadFrontmatterResult,
  readFrontmatter,
  type ValidateNoteResult,
  validateNote,
} from "#src/domain"
import { aLimits } from "./limits.ts"

export function aNote(): Note {
  return {
    statement: "Use pnpm, never npm",
    frontmatter: {
      id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
      type: "rule",
      created: "2026-10-04",
      updated: "2026-10-04",
    },
    body: "Use pnpm for every install and script.",
  }
}

export function validFrontmatterLines(): string[] {
  return ["id: 01JABCDE7XKQ2M9V3RTN8WPZ5F", "type: rule", "created: 2026-10-04", "updated: 2026-10-04"]
}

export function frontmatterLinesWith(line: string): string[] {
  const field = line.split(":")[0]
  return [...validFrontmatterLines().filter((validLine) => !validLine.startsWith(`${field}:`)), line]
}

export function frontmatterLinesWithListKey(): string[] {
  return ["id: not-a-ulid", "? [id]", ": 01JABCDE7XKQ2M9V3RTN8WPZ5F", ...validFrontmatterLines().slice(1)]
}

export function noteText(frontmatterLines: string[], body: string): string {
  return ["---", ...frontmatterLines, "---", "", body, ""].join("\n")
}

export function aParsedNote(frontmatterLines: string[], body: string): ParsedNote {
  return { statement: aNote().statement, frontmatter: frontmatterLines.join("\n"), body }
}

export function readBack(text: string): ValidateNoteResult {
  const limits = aLimits()
  const parsed = parseNote(aNote().statement, text)
  if (!parsed.succeeded) {
    return parsed
  }

  return validateNote(parsed.output, limits)
}

export function aNoteWithStatement(statement: string): Note {
  return { ...aNote(), statement }
}

export function aNoteWithBody(body: string): Note {
  return { ...aNote(), body }
}

export function noteAbout(statement: string, type: NoteType): Note {
  const note = aNote()
  return { ...note, statement, frontmatter: { ...note.frontmatter, type } }
}

export function aDontForgetNote(statement: string): Note {
  const note = noteAbout(statement, "rule")
  return { ...note, frontmatter: { ...note.frontmatter, dontForget: true } }
}

export function aQuestion(): Note {
  return noteAbout("Local or remote embeddings", "question")
}

export function aDecision(): Note {
  const note = noteAbout("Chose local embeddings", "decision")
  return { ...note, frontmatter: { ...note.frontmatter, id: "01JABCDE7XKQ2M9V3RTN8WPZ60" } }
}

export function readFrontmatterLines(lines: string[]): ReadFrontmatterResult {
  return readFrontmatter(lines.join("\n"))
}
