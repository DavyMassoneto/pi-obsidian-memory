import { describe, expect, it } from "vitest"

import { renderCompactionSummary } from "#src/domain"
import { observation } from "#test-helpers"

const lead = "These are condensed memories from earlier in this session."

const journeyBullet =
  "- Journey: a short, purely descriptive history of how this work reached its current state — for orientation only. It is not an instruction or a plan; do not read intent or next steps into it."

const mapBullet =
  "- Memory map: the notes kept in your long-term memory. It shows which notes exist, not what they say."

const observationsBullet = "- Observations: timestamped events from the conversation history, in chronological order."

const closing =
  "Treat these as past records. When entries conflict, the most recent observation reflects the latest known state. Work that prior observations describe as completed should not be redone unless the user explicitly asks to revisit it."

const map = [
  "## Memory map",
  "Your long-term memory is kept as notes in Obsidian vaults, one point per note.",
  "",
  "### project vault (loja)",
  "- `csv/CSV files use a semicolon separator.md` · rule",
].join("\n")

const observations = [
  observation("2026-10-26T14:02:00", 'User asked to add an "Export all" button next to the CSV export.'),
  observation("2026-10-26T14:05:00", "completed: Assistant added the button and wired it to exportOrdersCsv()."),
  observation("2026-10-26T14:05:00.01", 'User said the button label must read "Exportar tudo".'),
]

const observationLines = [
  '2026-10-26T14:02:00  User asked to add an "Export all" button next to the CSV export.',
  "2026-10-26T14:05:00  completed: Assistant added the button and wired it to exportOrdersCsv().",
  '2026-10-26T14:05:00.01  User said the button label must read "Exportar tudo".',
].join("\n")

describe("renderCompactionSummary", () => {
  it("the summary is the intro with bullets for present sections, then journey, map and observations joined by blank lines", () => {
    const journey = "### 2026-10-26 14:10\nThe session started by adding a CSV export to the orders page."

    expect(renderCompactionSummary({ journey, map, observations })).toBe(
      [
        [lead, [journeyBullet, mapBullet, observationsBullet].join("\n"), closing].join("\n\n"),
        `## Journey\n${journey}`,
        map,
        `## Observations\n${observationLines}`,
      ].join("\n\n"),
    )
  })

  it("without a journey the intro has no journey bullet and there is no journey section", () => {
    expect(renderCompactionSummary({ journey: "  \n", map, observations })).toBe(
      [
        [lead, [mapBullet, observationsBullet].join("\n"), closing].join("\n\n"),
        map,
        `## Observations\n${observationLines}`,
      ].join("\n\n"),
    )
  })

  it("a section with nothing to show is left out of the summary and of the intro", () => {
    expect(renderCompactionSummary({ journey: "", map, observations: [] })).toBe(
      [[lead, mapBullet, closing].join("\n\n"), map].join("\n\n"),
    )
    expect(renderCompactionSummary({ journey: "", map: "", observations })).toBe(
      [[lead, observationsBullet, closing].join("\n\n"), `## Observations\n${observationLines}`].join("\n\n"),
    )
  })

  it("with nothing to show the summary is empty", () => {
    expect(renderCompactionSummary({ journey: "", map: "", observations: [] })).toBe("")
  })
})
