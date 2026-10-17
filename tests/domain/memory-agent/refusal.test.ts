import { describe, expect, it } from "vitest"

import { MAX_REFUSAL_PROBLEMS, refusalObservation } from "#src/domain"

describe("refusalObservation", () => {
  it("turns problems into an unparseable refused observation", () => {
    expect(refusalObservation(["Search query is empty"])).toEqual({
      kind: "refused",
      action: "unparseable",
      problems: ["Search query is empty"],
    })
  })

  it("drops blank problems", () => {
    expect(refusalObservation(["", "  ", "real"]).problems).toEqual(["real"])
  })

  it("keeps at most the number of problems the schema allows", () => {
    const many = Array.from({ length: MAX_REFUSAL_PROBLEMS + 5 }, (_, number) => `problem ${number}`)
    expect(refusalObservation(many).problems).toHaveLength(MAX_REFUSAL_PROBLEMS)
  })
})
