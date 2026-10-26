import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { compactSession } from "#src/usecases"
import {
  compactionFixture,
  conversation,
  expectRegistrationLeaseReleased,
  noteWithId,
  observation,
  observationsRecord,
  putCatalogFile,
  summaryOf,
  turn,
} from "#test-helpers"

const SMALL_TAIL = { atContextTokens: 1000, tailTokens: 20, mapTokens: 2000 }

const EARLY = observation("2026-10-26T13:35:00", "User asked to add a CSV export to the orders page.")
const LATER = observation("2026-10-26T13:40:00", "User stated CSV files must use a semicolon separator.")

test("with an observed prefix, the summary has the intro, the map of the vault notes and the observations before the cut, and the cut is the snapped entry", async () => {
  const { vault, context } = await compactionFixture(SMALL_TAIL)
  await putCatalogFile(vault, "pnpm/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const records = [turn(1, 10), turn(2, 10), observationsRecord("o1", "r1", "r2", [EARLY]), turn(3, 10), turn(4, 10)]

  const result = await compactSession({ records }, context)

  expect(result).toEqual({
    succeeded: true,
    output: {
      firstKeptEntryId: "r3",
      summary: expect.stringMatching(/^These are condensed memories from earlier in this session\./),
    },
  })
  const summary = summaryOf(result)
  expect(summary).toContain("## Memory map")
  expect(summary).toContain("### global vault (global)")
  expect(summary).toContain("- `pnpm/Use pnpm.md` · rule")
  expect(summary).toContain("## Observations\n2026-10-26T13:35:00  User asked to add a CSV export to the orders page.")
  await expectRegistrationLeaseReleased(context)
})

test("observations of the kept tail are not in the summary", async () => {
  const { context } = await compactionFixture({ ...SMALL_TAIL, tailTokens: 40 })
  const records = [
    turn(1, 10),
    turn(2, 10),
    observationsRecord("o1", "r1", "r2", [EARLY]),
    turn(3, 10),
    turn(4, 10),
    observationsRecord("o2", "r3", "r4", [LATER]),
    turn(5, 10),
    turn(6, 10),
  ]

  const result = await compactSession({ records }, context)

  expect(result).toMatchObject({ succeeded: true, output: { firstKeptEntryId: "r3" } })
  const summary = summaryOf(result)
  expect(summary).toContain(EARLY.content)
  expect(summary).not.toContain(LATER.content)
})

test("with no observed prefix the compaction is refused as not observed", async () => {
  const { context } = await compactionFixture(SMALL_TAIL)

  expect(await compactSession({ records: conversation(4, 10) }, context)).toMatchObject({
    succeeded: false,
    reason: "not-observed",
    problems: [expect.any(String)],
  })
  await expectRegistrationLeaseReleased(context)
})

test("the map is cut at the configured map budget", async () => {
  const { vault, context } = await compactionFixture({ ...SMALL_TAIL, mapTokens: 120 })
  for (let number = 1; number <= 6; number++) {
    await putCatalogFile(vault, `notes/Note ${number}.md`, noteWithId(number, `Body ${number}.`, []))
  }
  const records = [turn(1, 10), turn(2, 10), observationsRecord("o1", "r1", "r2", [EARLY]), turn(3, 10), turn(4, 10)]

  const result = await compactSession({ records }, context)

  const summary = summaryOf(result)
  expect(summary).toContain("more notes are not listed; memory_search finds them.")
  expect(summary).not.toContain("Note 6.md")
})

test("with no config the compaction is refused as not configured", async () => {
  const { context } = await compactionFixture(SMALL_TAIL)
  await rm(context.configPath)

  expect(await compactSession({ records: conversation(4, 10) }, context)).toMatchObject({
    succeeded: false,
    reason: "not-configured",
  })
  await expectRegistrationLeaseReleased(context)
})
