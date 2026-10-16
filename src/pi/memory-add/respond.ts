import type { AddedMemory, AddMemoryResult, ExistingMemoryRefusal } from "#src/usecases"
import { NO_PROJECT_GUIDANCE, SAME_POINT_GUIDANCE } from "./constants.ts"
import type { MemoryAddResponse } from "./types.ts"

export function respondTo(result: AddMemoryResult): MemoryAddResponse {
  if (result.succeeded) {
    return reply(describeSaved(result.output), false)
  }

  switch (result.reason) {
    case "exists":
      if ("existing" in result) {
        return reply(describeExisting(result), true)
      }
      return reply(result.problems.join("\n"), true)
    case "invalid":
      return reply(
        ["Not saved. Fix and call again:", ...result.problems.map((problem) => `- ${problem}`)].join("\n"),
        true,
      )
    case "no-project":
      return reply([...result.problems, `Config: ${result.configPath}`, NO_PROJECT_GUIDANCE].join("\n"), true)
    case "not-configured":
    case "invalid-config":
      return reply([...result.problems, `Ask the user to configure memory in ${result.configPath}.`].join("\n"), true)
    case "not-directory":
    case "not-readable":
    case "not-writable":
    case "outside-vault":
    case "vault-missing":
    case "not-found":
      return reply(result.problems.join("\n"), true)
  }
}

function describeSaved(memory: AddedMemory): string {
  const warnings = memory.maintenanceProblems.map((problem) => `Maintenance warning: ${problem}`)
  return [`Saved in ${memory.vaultName}: ${memory.notePath}`, ...warnings].join("\n")
}

function describeExisting(refusal: ExistingMemoryRefusal): string {
  const { note } = refusal.existing
  const problems = refusal.problems.map((problem) => `Not saved: ${problem}.`)

  return [...problems, "", `Current note (${note.frontmatter.type}):`, note.body, "", SAME_POINT_GUIDANCE].join("\n")
}

function reply(text: string, isError: boolean): MemoryAddResponse {
  return { content: [{ type: "text", text }], details: undefined, isError }
}
