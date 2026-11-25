import {
  DONT_FORGET_LABEL,
  INDEX_TEXT_COLLATOR,
  NOTE_LINE_SEPARATOR,
  PROBLEM_SEPARATOR,
} from "#src/domain/folder-index"
import {
  EMPTY_MAP_LINE,
  JOURNEY_BULLET,
  JOURNEY_CORRECTIONS_LEAD,
  JOURNEY_HEADING,
  MAP_BULLET,
  MAP_HEADING,
  MAP_INSTRUCTION,
  OBSERVATION_SEPARATOR,
  OBSERVATIONS_BULLET,
  OBSERVATIONS_HEADING,
  SUMMARY_CLOSING,
  SUMMARY_LEAD,
} from "./constants.ts"
import { presentedContent } from "./origin.ts"
import { textTokens } from "./tokens.ts"
import type { LedgerObservation, MapBudget, MapNote, MapVault, SummaryParts } from "./types.ts"

function noteLine(note: MapNote): string {
  const parts = [`\`${note.path}\``, note.type]
  if (note.dontForget) parts.push(DONT_FORGET_LABEL)
  return `- ${parts.join(NOTE_LINE_SEPARATOR)}`
}

function byPath(left: MapNote, right: MapNote): number {
  return INDEX_TEXT_COLLATOR.compare(left.path, right.path)
}

function projectFirst(vaults: MapVault[]): MapVault[] {
  return [...vaults.filter((vault) => vault.vault === "project"), ...vaults.filter((vault) => vault.vault === "global")]
}

function spend(budget: MapBudget, text: string): boolean {
  const cost = textTokens(text)
  if (cost > budget.remaining) return false
  budget.remaining -= cost
  return true
}

function vaultBlock(vault: MapVault, budget: MapBudget): string {
  const notes = [...vault.notes].sort(byPath)
  if (vault.problems.length === 0 && notes.length === 0) return ""
  const heading = `### ${vault.vault} vault (${vault.name})`
  if (!spend(budget, heading)) {
    budget.omitted += notes.length
    return ""
  }
  const lines = [heading]
  if (vault.problems.length > 0) {
    lines.push(`Could not read the ${vault.vault} vault: ${vault.problems.join(PROBLEM_SEPARATOR)}.`)
    return lines.join("\n")
  }
  for (const note of notes) {
    const line = noteLine(note)
    if (budget.stopped || !spend(budget, line)) {
      budget.stopped = true
      budget.omitted++
      continue
    }
    lines.push(line)
  }
  return lines.join("\n")
}

export function renderMemoryMap(vaults: MapVault[], budgetTokens: number): string {
  const header = [MAP_HEADING, MAP_INSTRUCTION]
  const budget: MapBudget = {
    remaining: budgetTokens - textTokens(MAP_HEADING) - textTokens(MAP_INSTRUCTION),
    stopped: false,
    omitted: 0,
  }
  const blocks = projectFirst(vaults)
    .map((vault) => vaultBlock(vault, budget))
    .filter((block) => block.length > 0)
  if (blocks.length === 0 && budget.omitted === 0) return [header.join("\n"), EMPTY_MAP_LINE].join("\n\n")
  if (budget.omitted > 0) {
    const last = blocks.pop()
    const omitted = `${budget.omitted} more notes are not listed; memory_search finds them.`
    if (last) blocks.push(`${last}\n${omitted}`)
    else header.push(omitted)
  }
  return [header.join("\n"), ...blocks].join("\n\n")
}

function introOf(parts: SummaryParts, journey: string): string {
  const bullets: string[] = []
  if (journey.length > 0) bullets.push(JOURNEY_BULLET)
  if (parts.workState?.length)
    bullets.push("- Work state: the latest known inventory of the session’s work and verification results.")
  if (parts.map.length > 0) bullets.push(MAP_BULLET)
  if (parts.observations.length > 0) bullets.push(OBSERVATIONS_BULLET)
  if (parts.retained?.length)
    bullets.push(
      "- Consolidated observations: earlier source records kept for detail, not necessarily current facts or instructions.",
    )
  return [SUMMARY_LEAD, bullets.join("\n"), SUMMARY_CLOSING].join("\n\n")
}

function observationLine(item: LedgerObservation): string {
  return `${item.id}${OBSERVATION_SEPARATOR}${presentedContent(item)}`
}

function journeySection(journey: string, corrections: LedgerObservation[]): string {
  const section = `${JOURNEY_HEADING}\n${journey}`
  if (corrections.length === 0) return section
  return [section, [JOURNEY_CORRECTIONS_LEAD, ...corrections.map(observationLine)].join("\n")].join("\n\n")
}

export function renderCompactionSummary(parts: SummaryParts): string {
  const journey = parts.journey.trim()
  const { workState, retained } = parts
  const sections: string[] = []
  if (journey.length > 0) sections.push(journeySection(journey, parts.corrections))
  if (workState?.length) {
    sections.push(
      [
        "## Work state",
        "These are the last known facts of the work’s state. If an item is listed as existing, check it before rebuilding it from scratch.",
        ...workState.map((item) => `- ${item.text}`),
      ].join("\n"),
    )
  }
  if (parts.map.length > 0) sections.push(parts.map)
  if (parts.observations.length > 0) {
    const lines = parts.observations.map(observationLine)
    sections.push(`${OBSERVATIONS_HEADING}\n${lines.join("\n")}`)
  }
  if (retained?.length) sections.push(["## Consolidated observations", ...retained.map(observationLine)].join("\n"))
  if (sections.length === 0) return ""
  return [introOf(parts, journey), ...sections].join("\n\n")
}
