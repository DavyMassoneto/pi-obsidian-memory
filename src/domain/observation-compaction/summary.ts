import { MEMORY_MAP_HEADING, OBSERVATIONS_HEADING, SUMMARY_INTRO } from "./constants.ts"
import type { ObservationSummaryInput } from "./types.ts"

export function renderObservationSummary(input: ObservationSummaryInput): string {
  if (input.observations.length === 0 && input.memoryMap === "") return ""
  const parts = [SUMMARY_INTRO]
  if (input.memoryMap !== "") parts.push(`${MEMORY_MAP_HEADING}\n${input.memoryMap}`)
  if (input.observations.length > 0) {
    const lines = input.observations.map((item) =>
      JSON.stringify({ id: item.id, at: item.timestamp, content: item.content }),
    )
    parts.push(`${OBSERVATIONS_HEADING}\n${lines.join("\n")}`)
  }
  return parts.join("\n\n")
}
