import { describe, expect, it } from "vitest"

import { applyWorkState, ledgerOf, parseJourneyReply, renderCompactionSummary, retainedConsolidated } from "#src/domain"
import {
  consolidatedRecord,
  consolidationMetaRecord,
  observation,
  observationsRecord,
  rectifiedRecord,
  userRecord,
} from "#test-helpers"

const first = {
  sourceId: "2026-11-24T13:25:00",
  text: "[not said by the user] session skip-intro exists; live verification passed.",
}
const second = { sourceId: "2026-11-24T14:00:00", text: "npm test passed." }
const newer = {
  sourceId: "2026-11-24T15:00:00",
  text: "[not said by the user] session skip-intro is broken since 0.4.22.",
}
const material = [{ label: newer.sourceId, text: newer.text }]

describe("work state", () => {
  it("parses the journey and a closed list of state changes", () => {
    const reply = { journey: "Worked on session commands.", workState: [{ ...newer, replaces: [0] }] }
    expect(parseJourneyReply(JSON.stringify(reply))).toEqual({ succeeded: true, output: reply })
  })

  it("refuses missing state and malformed state changes", () => {
    for (const reply of [
      { journey: "" },
      { journey: "", workState: "text" },
      { journey: "", workState: [{ ...newer, replaces: [-1] }] },
      { journey: "", workState: [{ ...newer, replaces: [], extra: true }] },
    ]) {
      expect(parseJourneyReply(JSON.stringify(reply))).toMatchObject({ succeeded: false })
    }
  })

  it("carries over every item not explicitly changed, including after an empty reply", () => {
    expect(applyWorkState([first, second], [], material, [])).toEqual([first, second])
    expect(applyWorkState([first, second], [{ ...newer, replaces: [] }], material, [])).toEqual([first, second, newer])
  })

  it("only applies replacements or retirements citing eligible newer material, or corrections to the item source", () => {
    expect(applyWorkState([first, second], [{ ...newer, replaces: [0] }], material, [])).toEqual([second, newer])
    expect(applyWorkState([first, second], [{ ...newer, text: null, replaces: [0] }], material, [])).toEqual([second])
    expect(applyWorkState([first, second], [{ ...newer, replaces: [0] }], [], [])).toEqual([first, second])
    expect(
      applyWorkState([first, second], [{ ...first, replaces: [1] }], [{ label: first.sourceId, text: first.text }], []),
    ).toEqual([first, second])
    const correction = { ...first, text: "[not said by the user] Assistant verified session skip-intro." }
    expect(
      applyWorkState(
        [first, second],
        [{ ...correction, replaces: [0] }],
        [],
        [{ label: first.sourceId, text: correction.text }],
      ),
    ).toEqual([second, correction])
  })

  it("reads the latest state snapshot, including an explicit empty state, and defaults old records to empty", () => {
    const old = consolidatedRecord("c1", [first.sourceId], "old journey")
    const kept = consolidationMetaRecord("m1", { observationIds: [first.sourceId], workState: [first] })
    const newRecord = consolidationMetaRecord("m2", { observationIds: [], journey: "new journey", workState: [newer] })
    const empty = consolidationMetaRecord("m3", { observationIds: [], workState: [] })
    expect(ledgerOf([old]).workState).toEqual([])
    expect(ledgerOf([old, kept, newRecord]).workState).toEqual([newer])
    expect(ledgerOf([old, kept, newRecord, empty]).workState).toEqual([])
  })

  it("renders the state after the journey and retains the exact consolidated material outside the active pool", () => {
    const source = observation(first.sourceId, "Assistant verified session skip-intro live with exit code 0.")
    const ledger = ledgerOf([
      userRecord("u1", "Check the command", 4),
      observationsRecord("o1", "u1", "u1", [source]),
      rectifiedRecord("r1", {
        recordId: "o1",
        fromId: "u1",
        coversUpToId: "u1",
        userEntryIds: ["u1"],
        observations: [{ id: source.id, origin: "material" }],
      }),
      consolidatedRecord("c1", [source.id], "old journey"),
    ])
    const summary = renderCompactionSummary({
      journey: "The work progressed.",
      workState: [first],
      retained: retainedConsolidated(ledger, 1),
      map: "",
      observations: [],
      corrections: [],
    })
    expect(summary).toContain("- Work state:")
    expect(summary).toMatch(
      /## Journey\nThe work progressed\.\n\n## Work state\n[^\n]+check[^\n]+\n- \[not said by the user\] session skip-intro exists; live verification passed\./,
    )
    expect(summary).toContain("## Consolidated observations\n")
    expect(summary).toContain("[not said by the user] Assistant verified session skip-intro live with exit code 0.")
  })
})
