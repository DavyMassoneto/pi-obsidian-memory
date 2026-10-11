import { describe, expect, it } from "vitest"

import { createMemorySession } from "#/usecases"
import { deliveredRead, sessionIdentity } from "#test-helpers"

describe("MemorySession full-read receipts", () => {
  it("stores complete read metadata by exact scope/path, not duplicate id or canonical alias", () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    const read = deliveredRead()
    const lower = { ...deliveredRead(), path: "rules/keep case.md", rawHash: "lower" }
    const project = { ...deliveredRead(), canonicalVault: "D:/Project" }
    project.vault = "project"
    expect(session.getReceipt(stamp, read)).toBeNull()
    expect(session.rememberGet(stamp, read)).toBe(true)
    expect(session.rememberGet(stamp, lower)).toBe(true)
    expect(session.rememberGet(stamp, project)).toBe(true)
    expect(session.getReceipt(stamp, read)).toEqual(read)
    expect(session.getReceipt(stamp, lower)).toEqual(lower)
    expect(session.getReceipt(stamp, project)).toEqual(project)
    expect(session.getReceipt(stamp, { ...read, path: "Rules/Keep Case.md" })).toBeNull()
    expect(session.getReceipt(stamp, { ...read, path: "Rules\\Keep Case.MD" })).toBeNull()
  })

  it("replaces only the same address with the latest get and consumes it once", () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    const first = deliveredRead()
    const next = { ...deliveredRead(), sourceCallId: "get-two", rawHash: "changed", canonicalPath: "new-target.MD" }
    const independent = { ...deliveredRead(), path: "Another.MD" }
    session.rememberGet(stamp, first)
    session.rememberGet(stamp, independent)
    session.rememberGet(stamp, next)
    expect(session.getReceipt(stamp, first)).toEqual(next)
    session.consumeReceipt(stamp, first)
    session.consumeReceipt(stamp, first)
    expect(session.getReceipt(stamp, first)).toBeNull()
    expect(session.getReceipt(stamp, independent)).toEqual(independent)
  })

  it("retains nullable diagnostic identity and invalid-frontmatter analysis without inventing identity", () => {
    const session = createMemorySession(sessionIdentity())
    const read = deliveredRead()
    read.id = null
    read.analysis.frontmatter = null
    read.analysis.searchable = false
    expect(session.rememberGet(session.stamp(), read)).toBe(true)
    expect(session.getReceipt(session.stamp(), read)).toEqual(read)
  })

  it("does not let stale reads, lookups or consumption cross generations", () => {
    const session = createMemorySession(sessionIdentity())
    const stale = session.stamp()
    const read = deliveredRead()
    session.rememberGet(stale, read)
    session.invalidate(sessionIdentity())
    const fresh = session.stamp()
    expect(session.getReceipt(fresh, read)).toBeNull()
    expect(session.rememberGet(stale, read)).toBe(false)
    session.rememberGet(fresh, read)
    expect(session.getReceipt(stale, read)).toBeNull()
    session.consumeReceipt(stale, read)
    expect(session.getReceipt(fresh, read)).toEqual(read)
    const replacement = createMemorySession(sessionIdentity())
    expect(replacement.getReceipt(replacement.stamp(), read)).toBeNull()
  })

  it("isolates every mutable input and returned metadata object and diagnostic array", () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    const input = deliveredRead()
    const expected = deliveredRead()
    session.rememberGet(stamp, input)
    input.path = "changed"
    input.canonicalVault = "changed"
    input.stat.size = 999
    input.analysis.parsed.body = "changed"
    if (input.analysis.frontmatter) input.analysis.frontmatter.updated = "2027-01-01"
    input.analysis.frontmatterProblems.push("changed")
    input.analysis.nameProblems.push("changed")
    input.analysis.bodyProblems.push("changed")
    expect(session.getReceipt(stamp, expected)).toEqual(expected)
    const output = session.getReceipt(stamp, expected)
    expect(output).not.toBeNull()
    if (!output) throw new Error("Missing receipt")
    output.rawHash = "changed"
    output.sourceCallId = "changed"
    output.stat.inode = 999
    output.analysis.parsed.frontmatter = "changed"
    if (output.analysis.frontmatter) output.analysis.frontmatter.type = "fact"
    output.analysis.frontmatterProblems.length = 0
    output.analysis.nameProblems.length = 0
    output.analysis.bodyProblems.length = 0
    expect(session.getReceipt(stamp, expected)).toEqual(expected)
  })
})
