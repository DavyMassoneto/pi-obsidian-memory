import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { compactSession } from "#src/usecases"
import {
  ASKED_FOR_CSV,
  compactionFixture,
  consolidatedBeforeOrigins,
  conversation,
  csvRectification,
  expectRegistrationLeaseReleased,
  noteWithId,
  ORDERED_IN_TEST_PROMPT,
  observation,
  observationsRecord,
  putCatalogFile,
  RESTATED_NO_COMMIT,
  recordedBeforeOrigins,
  rectifiedRecord,
  SAID_IN_TRANSCRIPT,
  SAID_REWRITTEN,
  summaryOf,
  transcriptOrigins,
  transcriptRectification,
  transcriptRepaired,
  turn,
  userRecord,
} from "#test-helpers"

const SMALL_TAIL = { atContextTokens: 1000, tailTokens: 20, mapTokens: 2000 }

const EARLY = observation("2026-10-26T13:35:00", "User asked to add a CSV export to the orders page.")
const LATER = observation("2026-10-26T13:40:00", "User stated CSV files must use a semicolon separator.")
const EARLY_IS_THE_USERS = rectifiedRecord("x1", {
  recordId: "o1",
  fromId: "r1",
  coversUpToId: "r2",
  userEntryIds: ["r1"],
  observations: [{ id: EARLY.id, origin: "user", supportedBy: "r1", quote: "message 1" }],
})
const TAIL = [userRecord("u9", "next", 10), userRecord("u10", "last", 10)]

test("with an observed prefix, the summary has the intro, the map of the vault notes and the observations before the cut, and the cut is the snapped entry", async () => {
  const { vault, context } = await compactionFixture(SMALL_TAIL)
  await putCatalogFile(vault, "pnpm/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const records = [
    turn(1, 10),
    turn(2, 10),
    observationsRecord("o1", "r1", "r2", [EARLY]),
    turn(3, 10),
    turn(4, 10),
    EARLY_IS_THE_USERS,
  ]

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

test("observations recorded before origins were kept are shown as unverified until they are rectified", async () => {
  const { context } = await compactionFixture(SMALL_TAIL)
  const records = [...recordedBeforeOrigins(), ...TAIL]

  const summary = summaryOf(await compactSession({ records }, context))

  expect(summary).toContain(`${SAID_IN_TRANSCRIPT.id}  [origin unverified] ${SAID_IN_TRANSCRIPT.content}`)
  expect(summary).toContain(`${ASKED_FOR_CSV.id}  [origin unverified] ${ASKED_FOR_CSV.content}`)
})

test("from the rectification records on, the summary shows the rectified wording, marks what could not be rewritten, and keeps what the user really said as the user's", async () => {
  const { context } = await compactionFixture(SMALL_TAIL)
  const records = [
    ...recordedBeforeOrigins(),
    rectifiedRecord("x1", transcriptRectification(transcriptRepaired())),
    rectifiedRecord("x2", csvRectification()),
    ...TAIL,
  ]
  const unrepaired = [
    ...recordedBeforeOrigins(),
    rectifiedRecord("x1", transcriptRectification(transcriptOrigins())),
    ...TAIL,
  ]

  const summary = summaryOf(await compactSession({ records }, context))

  expect(summary).toContain(`\n${SAID_IN_TRANSCRIPT.id}  [not said by the user] ${SAID_REWRITTEN}\n`)
  expect(summary).not.toContain(SAID_IN_TRANSCRIPT.content)
  expect(summary).toContain(
    `\n${RESTATED_NO_COMMIT.id}  [said by the user earlier in this session] ${RESTATED_NO_COMMIT.content}\n`,
  )
  expect(summary).toContain(`\n${ASKED_FOR_CSV.id}  ${ASKED_FOR_CSV.content}\n`)
  expect(summary).toContain(`\n${ORDERED_IN_TEST_PROMPT.id}  ${ORDERED_IN_TEST_PROMPT.content}`)
  expect(summaryOf(await compactSession({ records: unrepaired }, context))).toContain(
    `${SAID_IN_TRANSCRIPT.id}  [not said by the user] ${SAID_IN_TRANSCRIPT.content}`,
  )
})

test("a journey written from an observation later rectified is followed by the correction", async () => {
  const { context } = await compactionFixture(SMALL_TAIL)
  const rectification = transcriptRectification(transcriptRepaired())
  const records = [...consolidatedBeforeOrigins(), rectifiedRecord("x1", rectification), ...TAIL]

  const summary = summaryOf(await compactSession({ records }, context))

  expect(summary).toContain(
    "## Journey\nThe user ordered the bot into production.\n\nCorrections to the journey above:",
  )
  expect(summary).toContain(`This session's user said none of them;`)
  expect(summary).toContain(`\n${SAID_IN_TRANSCRIPT.id}  [not said by the user] ${SAID_REWRITTEN}\n\n## Memory map`)
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
