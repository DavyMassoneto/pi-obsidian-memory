import { SETUP_GUIDANCE } from "#src/pi/memory-add"
import type { GetMemoryRequest, GetMemoryResult } from "#src/usecases"
import { GET_FIELD_SEPARATOR, GET_NEEDS_FIXING_HEADING, UNCLOSED_NOTICE } from "./constants.ts"
import type { MemoryGetResponse } from "./types.ts"

export function respondToGet(
  request: Pick<GetMemoryRequest, "vault" | "path">,
  result: GetMemoryResult,
): MemoryGetResponse {
  if (result.succeeded) {
    if (result.output.kind === "folder") return reply([result.output.text], false)
    const { file } = result.output
    const problems = [
      ...file.analysis.frontmatterProblems,
      ...file.analysis.nameProblems,
      ...file.analysis.bodyProblems,
    ]
    const lines = [[request.vault, request.path].join(GET_FIELD_SEPARATOR), file.text]
    if (problems.length > 0) lines.push(GET_NEEDS_FIXING_HEADING, ...problems.map((problem) => `- ${problem}`))
    return reply(lines, false)
  }
  switch (result.reason) {
    case "unclosed-frontmatter":
      return reply(
        [UNCLOSED_NOTICE, GET_NEEDS_FIXING_HEADING, ...result.problems.map((problem) => `- ${problem}`)],
        true,
      )
    case "not-configured":
    case "invalid-config":
      return reply([...result.problems, SETUP_GUIDANCE], true)
    default:
      return reply(result.problems, true)
  }
}

function reply(lines: string[], isError: boolean): MemoryGetResponse {
  return { content: [{ type: "text", text: lines.join("\n") }], details: undefined, isError }
}
