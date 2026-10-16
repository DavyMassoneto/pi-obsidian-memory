import { describe, expect, it } from "vitest"

import { boundedFailureDetail } from "#src/domain"

describe("boundedFailureDetail", () => {
  it("keeps a detail of up to 500 characters whole", () => {
    expect(boundedFailureDetail("short")).toBe("short")
    expect(boundedFailureDetail("x".repeat(500))).toBe("x".repeat(500))
    expect(boundedFailureDetail("")).toBe("")
  })

  it("cuts a longer detail to 500 characters", () => {
    expect(boundedFailureDetail("x".repeat(501))).toBe("x".repeat(500))
    expect(boundedFailureDetail("y".repeat(5000))).toHaveLength(500)
  })

  it("does not leave half of a surrogate pair at the cut", () => {
    expect(boundedFailureDetail(`${"a".repeat(499)}😀tail`)).toBe("a".repeat(499))
  })
})
