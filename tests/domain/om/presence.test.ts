import { describe, expect, it } from "vitest"

import { omLoaded } from "#src/domain"

describe("omLoaded", () => {
  it("om and om:… commands mean OM is loaded, also with a numbered suffix; other names do not", () => {
    expect(omLoaded(["om:status"])).toBe(true)
    expect(omLoaded(["om:1"])).toBe(true)
    expect(omLoaded(["memory-setup", "om"])).toBe(true)
    expect(omLoaded(["memory-setup", "omni"])).toBe(false)
    expect(omLoaded(["memory-om", "memory-doctor"])).toBe(false)
    expect(omLoaded([])).toBe(false)
  })
})
