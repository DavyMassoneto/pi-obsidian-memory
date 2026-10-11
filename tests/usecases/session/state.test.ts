import { describe, expect, it } from "vitest"

import { createMemorySession } from "#/usecases"
import { deliveredRead, sessionIdentity } from "#test-helpers"

describe("MemorySession generation", () => {
  it.each([
    { reentry: "invalidate", generation: 2, current: true },
    { reentry: "abort", generation: 1, current: false },
  ])("publishes fresh authority before an abort listener reenters $reentry", ({ reentry, generation, current }) => {
    const session = createMemorySession(sessionIdentity())
    const stale = session.stamp()
    const read = deliveredRead()
    session.acceptConfiguration(stale, "old")
    session.rememberGet(stale, read)
    const generations: number[] = []
    const observed: boolean[] = []
    const signals: AbortSignal[] = []
    session.signal(stale).addEventListener("abort", () => {
      const fresh = session.stamp()
      generations.push(fresh.generation)
      observed.push(session.isCurrent(stale), session.isCurrent(fresh), !session.getReceipt(fresh, read))
      const signal = session.signal(fresh)
      observed.push(signal.aborted)
      signals.push(signal)
      if (reentry === "invalidate") session.invalidate(sessionIdentity())
      else session.abortPending()
    })
    session.invalidate(sessionIdentity())
    expect(generations).toEqual([1])
    expect(observed).toEqual([false, true, true, false])
    expect(signals.map((signal) => signal.aborted)).toEqual([true])
    expect(session.stamp().generation).toBe(generation)
    expect(session.isCurrent(session.stamp())).toBe(current)
    expect(session.acceptConfiguration(session.stamp(), "new")).toBe(current)
  })

  it("publishes terminal authority before a shutdown listener attempts reentry", async () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    const read = deliveredRead()
    session.rememberGet(stamp, read)
    const observed: boolean[] = []
    session.signal(stamp).addEventListener("abort", () => {
      observed.push(session.isCurrent(stamp), session.rememberGet(stamp, read))
      session.invalidate(sessionIdentity())
      session.abortPending()
      observed.push(session.isCurrent(session.stamp()), session.acceptConfiguration(session.stamp(), "new"))
    })
    session.abortPending()
    expect(observed).toEqual([false, false, false, false])
    expect(session.getReceipt(session.stamp(), read)).toBeNull()
    expect(session.signal(session.stamp()).aborted).toBe(true)
    expect(await session.acquire(session.stamp(), new AbortController().signal)).toBeNull()
    await session.drain()
  })

  it("binds stamps to one instance, identity and generation", () => {
    const identity = { ...sessionIdentity() }
    const session = createMemorySession(identity)
    const stamp = session.stamp()
    const other = createMemorySession(identity)
    expect(stamp).toMatchObject({ ...identity, generation: 0 })
    expect(session.isCurrent(stamp)).toBe(true)
    expect(other.isCurrent(stamp)).toBe(false)
    expect(session.isCurrent({ ...stamp })).toBe(false)
    expect(other.signal(stamp).aborted).toBe(true)
    identity.sessionId = "mutated"
    identity.branchId = "mutated"
    expect(Reflect.set(stamp, "generation", 99)).toBe(false)
    expect(Reflect.set(stamp, "branchId", "mutated")).toBe(false)
    expect(session.stamp()).toMatchObject({ sessionId: "session-one", branchId: "branch-one", generation: 0 })
  })

  it("invalidates even on same-identity reload and cannot restore authority on return to a branch", () => {
    const session = createMemorySession(sessionIdentity())
    const original = session.stamp()
    const signal = session.signal(original)
    session.rememberGet(original, deliveredRead())
    session.invalidate(sessionIdentity())
    expect(signal.aborted).toBe(true)
    expect(session.isCurrent(original)).toBe(false)
    expect(session.signal(original).aborted).toBe(true)
    expect(session.stamp().generation).toBe(1)
    expect(session.getReceipt(session.stamp(), deliveredRead())).toBeNull()
    session.invalidate({ sessionId: "session-two", branchId: null })
    expect(session.stamp()).toMatchObject({ sessionId: "session-two", branchId: null, generation: 2 })
    session.invalidate(sessionIdentity())
    expect(session.stamp().generation).toBe(3)
    expect(session.isCurrent(original)).toBe(false)
  })

  it("binds the first configuration and invalidates changed configuration for caller restart", () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    const signal = session.signal(stamp)
    expect(session.acceptConfiguration(stamp, "first")).toBe(true)
    expect(session.acceptConfiguration(stamp, "first")).toBe(true)
    session.rememberGet(stamp, deliveredRead())
    expect(session.acceptConfiguration(stamp, "second")).toBe(false)
    expect(signal.aborted).toBe(true)
    expect(session.isCurrent(stamp)).toBe(false)
    expect(session.acceptConfiguration(stamp, "first")).toBe(false)
    const fresh = session.stamp()
    expect(session.getReceipt(fresh, deliveredRead())).toBeNull()
    expect(session.acceptConfiguration(fresh, "second")).toBe(true)
    expect(session.acceptConfiguration(fresh, "second")).toBe(true)
  })

  it("clears configuration binding on identity invalidation", () => {
    const session = createMemorySession(sessionIdentity())
    session.acceptConfiguration(session.stamp(), "first")
    session.invalidate({ sessionId: "session-one", branchId: "another-branch" })
    const stamp = session.stamp()
    expect(session.acceptConfiguration(stamp, "second")).toBe(true)
    expect(session.isCurrent(stamp)).toBe(true)
  })

  it("makes abort terminal and never reopens admissions through invalidation", async () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    session.rememberGet(stamp, deliveredRead())
    session.abortPending()
    session.abortPending()
    expect(session.signal(stamp).aborted).toBe(true)
    expect(session.isCurrent(stamp)).toBe(false)
    expect(session.rememberGet(stamp, deliveredRead())).toBe(false)
    expect(session.getReceipt(stamp, deliveredRead())).toBeNull()
    expect(session.acceptConfiguration(stamp, "hash")).toBe(false)
    session.invalidate(sessionIdentity())
    expect(session.isCurrent(session.stamp())).toBe(false)
    expect(session.signal(session.stamp()).aborted).toBe(true)
    expect(await session.acquire(session.stamp(), new AbortController().signal)).toBeNull()
    await session.drain()
    await session.drain()
    const replacement = createMemorySession(sessionIdentity())
    expect(replacement.isCurrent(replacement.stamp())).toBe(true)
    expect(replacement.isCurrent(stamp)).toBe(false)
  })
})
