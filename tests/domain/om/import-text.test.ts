import { describe, expect, it } from "vitest"

import { importParts } from "#src/domain"

describe("importParts", () => {
  it("reads CRLF text as LF", () => {
    expect(importParts("one\r\ntwo\r\nthree", 100)).toEqual(["one\ntwo\nthree"])
  })

  it("splits text at line ends into parts within the token limit", () => {
    const lines = ["a".repeat(30), "b".repeat(30), "c".repeat(30), "d".repeat(30)]
    const parts = importParts(lines.join("\n"), 16)
    expect(parts).toEqual([`${lines[0]}\n${lines[1]}`, `${lines[2]}\n${lines[3]}`])
    expect(parts.every((part) => part.length <= 64)).toBe(true)
  })

  it("cuts a single line longer than the limit", () => {
    const parts = importParts(`head\n${"x".repeat(150)}\ntail`, 16)
    expect(parts).toEqual(["head", "x".repeat(64), "x".repeat(64), `${"x".repeat(22)}\ntail`])
  })

  it("keeps short text as one part", () => {
    expect(importParts("a short note\n\nwith a blank line\n", 1000)).toEqual(["a short note\n\nwith a blank line\n"])
  })

  it("gives no part for empty text", () => {
    expect(importParts("", 16)).toEqual([])
  })
})
