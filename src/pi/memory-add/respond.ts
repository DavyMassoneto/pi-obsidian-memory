import type { AddMemoryResult, ExistingMemoryRefusal } from "#/usecases/add-memory"
import { NO_PROJECT_GUIDANCE, SAME_POINT_GUIDANCE } from "./constants.ts"
import type { MemoryAddResponse } from "./types.ts"

export function respondTo(result: AddMemoryResult): MemoryAddResponse {
  if (result.succeeded) {
    return reply(`Saved in ${result.output.vaultName}: ${result.output.notePath}`, false)
  }

  if ("existing" in result) {
    return reply(describeExisting(result), true)
  }

  if (result.reason === "invalid") {
    const lines = result.problems.map((problem) => `- ${problem}`)
    return reply(["Not saved. Fix and call again:", ...lines].join("\n"), true)
  }

  if (result.reason === "no-project") {
    return reply([...result.problems, NO_PROJECT_GUIDANCE].join("\n"), true)
  }

  return reply(result.problems.join("\n"), true)
}

function describeExisting(refusal: ExistingMemoryRefusal): string {
  const { note } = refusal.existing
  const problems = refusal.problems.map((problem) => `Not saved: ${problem}.`)

  return [...problems, "", `Current note (${note.frontmatter.type}):`, note.body, "", SAME_POINT_GUIDANCE].join("\n")
}

function reply(text: string, isError: boolean): MemoryAddResponse {
  return { content: [{ type: "text", text }], details: undefined, isError }
}
