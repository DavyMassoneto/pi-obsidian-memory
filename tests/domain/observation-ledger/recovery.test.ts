import { describe, expect, it } from "vitest"

import { exhaustedRectifications, pendingWrittenNotes, RECTIFY_ATTEMPTS } from "#src/domain"
import {
  ASKED_FOR_CSV,
  buildRectification,
  consolidationMetaRecord,
  csvRectification,
  noteWrittenRecord,
  ORDERED_IN_TEST_PROMPT,
  recordedBeforeOrigins,
  rectifiedRecord,
  rectifyFailedRecord,
  SAID_IN_TRANSCRIPT,
} from "#test-helpers"

const NOTE = { vault: "global" as const, path: "rules/Never commit.md" }
const OTHER = { vault: "global" as const, path: "rules/Use pnpm.md" }

describe("pendingWrittenNotes", () => {
  it("a note written by a batch that never reached its end is still owed to the batch that takes those observations again", () => {
    const records = [
      ...recordedBeforeOrigins(),
      noteWrittenRecord("n1", { observationIds: [ASKED_FOR_CSV.id], ...NOTE }),
      noteWrittenRecord("n2", { observationIds: [ASKED_FOR_CSV.id], ...NOTE }),
      noteWrittenRecord("n3", { observationIds: [SAID_IN_TRANSCRIPT.id], ...OTHER }),
    ]

    expect(pendingWrittenNotes(records, [ASKED_FOR_CSV.id, ORDERED_IN_TEST_PROMPT.id])).toEqual([NOTE])
  })

  it("once a finished batch lists the note, nothing is owed", () => {
    const records = [
      ...recordedBeforeOrigins(),
      noteWrittenRecord("n1", { observationIds: [ASKED_FOR_CSV.id], ...NOTE }),
      consolidationMetaRecord("m1", { observationIds: [ASKED_FOR_CSV.id], notes: [NOTE] }),
    ]

    expect(pendingWrittenNotes(records, [ASKED_FOR_CSV.id])).toEqual([])
  })
})

describe("exhaustedRectifications", () => {
  const failures = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      rectifyFailedRecord(`f${index}`, { recordId: "o2", problem: "Model call unsupported" }),
    )

  it("a record whose check failed the allowed number of times is closed: what is still unverified becomes unconfirmed, pointing at the record and its range", () => {
    const records = [...recordedBeforeOrigins(), ...failures(RECTIFY_ATTEMPTS)]

    expect(exhaustedRectifications(records)).toEqual([
      {
        recordId: "o2",
        fromId: "u2",
        coversUpToId: "t2",
        userEntryIds: ["u2"],
        observations: [
          { id: ASKED_FOR_CSV.id, origin: "unconfirmed" },
          { id: ORDERED_IN_TEST_PROMPT.id, origin: "unconfirmed" },
        ],
      },
    ])
  })

  it("fewer failures, or a record that got rectified meanwhile, close nothing", () => {
    const fewer = [...recordedBeforeOrigins(), ...failures(RECTIFY_ATTEMPTS - 1)]
    const settled = [
      ...recordedBeforeOrigins(),
      ...failures(RECTIFY_ATTEMPTS),
      rectifiedRecord("x2", csvRectification()),
      rectifiedRecord("x0", buildRectification()),
    ]

    expect(exhaustedRectifications(fewer)).toEqual([])
    expect(exhaustedRectifications(settled)).toEqual([])
  })
})
