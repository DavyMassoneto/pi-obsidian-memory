import { checkNoteText, parseNote, readFrontmatter } from "#src/domain/note"
import type { AnalyzeVaultNoteRequest, ParsedVaultNote, VaultNoteAnalysis, VaultNoteProblems } from "./types.ts"

export function analyzeVaultNote(request: AnalyzeVaultNoteRequest): VaultNoteAnalysis {
  const parsed = parseNote(request.statement, request.text)
  if (!parsed.succeeded) {
    const text = textProblems(request, request.text)
    return { status: "unclosed", searchable: false, needsFixing: true, ...text, frontmatterProblems: parsed.problems }
  }

  const result: ParsedVaultNote = {
    status: "parsed",
    parsed: parsed.output,
    frontmatter: null,
    searchable: false,
    needsFixing: true,
    ...textProblems(request, parsed.output.body),
  }
  const frontmatter = readFrontmatter(parsed.output.frontmatter)
  if (!frontmatter.succeeded) return { ...result, frontmatterProblems: frontmatter.problems }

  return {
    ...result,
    frontmatter: frontmatter.output,
    searchable: !request.archived && !("archived" in frontmatter.output),
    needsFixing: result.nameProblems.length + result.bodyProblems.length > 0,
  }
}

function textProblems(request: AnalyzeVaultNoteRequest, body: string): VaultNoteProblems {
  const problems = checkNoteText(request.statement, body, request.limits)
  return {
    frontmatterProblems: [],
    nameProblems: problems.filter((problem) => problem.startsWith("statement:")),
    bodyProblems: problems.filter((problem) => problem.startsWith("body:")),
  }
}
