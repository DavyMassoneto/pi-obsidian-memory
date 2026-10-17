import { describe, expect, it } from "vitest"

import { refusalObservation } from "#src/domain"

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

  it("keeps every problem", () => {
    const many = Array.from({ length: 25 }, (_, number) => `problem ${number}`)
    expect(refusalObservation(many).problems).toEqual(many)
  })
})
