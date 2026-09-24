import { describe, expect, it } from "vitest"

import { readOptions } from "#scripts"

describe("readOptions", () => {
  it("without arguments, the flags are off and the version comes from the commits", () => {
    expect(readOptions([])).toEqual({ "dry-run": false, bump: "auto", yes: false, help: false })
  })

  it("reads the given options", () => {
    expect(readOptions(["--dry-run", "--bump", "minor", "-y"])).toEqual({
      "dry-run": true,
      bump: "minor",
      yes: true,
      help: false,
    })
  })

  it("rejects an unknown --bump", () => {
    expect(() => readOptions(["--bump", "nothing"])).toThrow(
      /command-line options .*is not in the expected format: \/bump/,
    )
  })

  it("rejects an unknown option", () => {
    expect(() => readOptions(["--xyz"])).toThrow(/xyz/)
  })
})
