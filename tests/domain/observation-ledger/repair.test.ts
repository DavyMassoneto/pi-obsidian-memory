import { describe, expect, it } from "vitest"

import {
  closedOrigins,
  falseAttributions,
  ledgerOf,
  materialSources,
  parseRepairReply,
  rectifiedData,
  repairChecks,
  repairedObservations,
} from "#src/domain"
import {
  csvCheck,
  csvRectification,
  RESTATED_NO_COMMIT,
  recordedBeforeOrigins,
  rectifiedRecord,
  SAID_IN_TRANSCRIPT,
  SAID_REWRITTEN,
  transcriptCheck,
  transcriptOrigins,
  transcriptRectification,
  transcriptRepaired,
} from "#test-helpers"

describe("repairedObservations", () => {
  const repair = {
    id: SAID_IN_TRANSCRIPT.id,
    sourceId: "t1",
    quote: "put the bot in production",
    content: SAID_REWRITTEN,
  }

  it("the false attributions of a check are the statements found nowhere in the user's messages and not yet rewritten", () => {
    expect(falseAttributions(transcriptCheck(), transcriptOrigins())).toEqual([
      { id: SAID_IN_TRANSCRIPT.id, content: SAID_IN_TRANSCRIPT.content },
    ])
    expect(falseAttributions(csvCheck(), csvRectification().observations)).toEqual([])
    expect(falseAttributions(transcriptCheck(), transcriptRepaired())).toEqual([])
  })

  it("a rewrite whose quoted words are in the named entry of the range replaces the text and keeps the entry and the words", () => {
    const sources = materialSources(recordedBeforeOrigins(), transcriptCheck(), 1000)
    expect(repairedObservations(sources, transcriptOrigins(), [repair])).toEqual(transcriptRepaired())
  })

  it("changing accents or case in a repair's quotation does not count as evidence", () => {
    const sources = materialSources(recordedBeforeOrigins(), transcriptCheck(), 1000)
    const accented = { ...repair, quote: "pút the bót in PRODUCTION" }
    expect(repairedObservations(sources, transcriptOrigins(), [accented])).toEqual(transcriptOrigins())
  })

  it("a rewrite is ignored when its source is outside the range, is a user message, does not contain the quoted words, or has more than one line", () => {
    const sources = materialSources(recordedBeforeOrigins(), transcriptCheck(), 1000)
    const refused = [
      { ...repair, sourceId: "t2" },
      { ...repair, sourceId: "u0", quote: "Nunca faça commit" },
      { ...repair, quote: "deploy now" },
      { ...repair, sourceId: null, quote: null },
      { ...repair, content: "two\nlines" },
      { ...repair, content: "   " },
      { ...repair, id: RESTATED_NO_COMMIT.id },
    ]

    for (const candidate of refused) {
      expect(repairedObservations(sources, transcriptOrigins(), [candidate])).toEqual(transcriptOrigins())
    }
  })

  it("the rectification points at the record, its range and the user messages of the range", () => {
    expect(rectifiedData(csvCheck(), csvRectification().observations)).toEqual(csvRectification())
  })
})

describe("repairChecks", () => {
  const pending = { id: SAID_IN_TRANSCRIPT.id, origin: "material" as const }

  it("a record whose rectification left a false attribution without a proven source is still to be rewritten, with the range it was read in", () => {
    const records = [...recordedBeforeOrigins(), rectifiedRecord("x1", transcriptRectification(transcriptOrigins()))]

    expect(repairChecks(records)).toEqual([
      {
        check: {
          recordId: "o1",
          fromId: "a1",
          coversUpToId: "t1",
          userEntryIds: [],
          userMessages: [],
          materialSources: [],
          observations: [{ id: SAID_IN_TRANSCRIPT.id, content: SAID_IN_TRANSCRIPT.content }],
        },
        origins: [pending],
      },
    ])
  })

  it("once rewritten, or closed as unconfirmed, nothing is left to rewrite, and only those observations change", () => {
    const base = [...recordedBeforeOrigins(), rectifiedRecord("x1", transcriptRectification(transcriptOrigins()))]
    const rewritten = rectifiedRecord("x2", transcriptRectification(transcriptRepaired().slice(0, 1)))
    const closed = rectifiedRecord("x2", transcriptRectification(closedOrigins([pending])))

    expect(repairChecks([...base, rewritten])).toEqual([])
    expect(repairChecks([...base, closed])).toEqual([])
    expect(ledgerOf([...base, closed]).ranges[1]?.observations.map((item) => item.origin)).toEqual([
      "unconfirmed",
      "mention",
      "restated",
    ])
  })

  it("a record not yet verified has nothing to rewrite", () => {
    expect(repairChecks(recordedBeforeOrigins())).toEqual([])
  })
})

describe("parseRepairReply", () => {
  it("reads repairs and refuses anything else", () => {
    const repairs = [{ id: SAID_IN_TRANSCRIPT.id, sourceId: null, quote: null, content: "x" }]

    expect(parseRepairReply(JSON.stringify({ repairs }))).toEqual({ succeeded: true, output: repairs })
    expect(parseRepairReply("done")).toEqual({ succeeded: false, problems: ["Invalid repair JSON"] })
  })
})
