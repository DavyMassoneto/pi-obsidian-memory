import { describe, expect, it } from "vitest"

import { createMemorySession } from "#/usecases"
import { deferredSessionStep, sessionIdentity } from "#test-helpers"

describe("MemorySession leases", () => {
  it.each(["caller", "generation"])(
    "retains a granted lease when %s aborts before its continuation",
    async (source) => {
      const session = createMemorySession(sessionIdentity())
      const stamp = session.stamp()
      const caller = new AbortController()
      const first = await session.acquire(stamp, caller.signal)
      expect(first).not.toBeNull()
      const granted = session.acquire(stamp, caller.signal)
      first?.release()
      if (source === "caller") caller.abort()
      else session.abortPending()
      let drained = false
      const drain = session.drain().then(() => {
        drained = true
      })
      const lease = await granted
      expect(lease).not.toBeNull()
      await Promise.resolve()
      expect(drained).toBe(false)
      lease?.release()
      await drain
      expect(drained).toBe(true)
    },
  )

  it("admits contention in FIFO order with idempotent release", async () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    const signal = new AbortController().signal
    const first = await session.acquire(stamp, signal)
    expect(first).not.toBeNull()
    const order: string[] = []
    const second = session.acquire(stamp, signal).then((lease) => {
      order.push("second")
      return lease
    })
    const third = session.acquire(stamp, signal).then((lease) => {
      order.push("third")
      return lease
    })
    await Promise.resolve()
    expect(order).toEqual([])
    first?.release()
    const secondLease = await second
    expect(secondLease).not.toBeNull()
    first?.release()
    await Promise.resolve()
    expect(order).toEqual(["second"])
    secondLease?.release()
    const thirdLease = await third
    expect(thirdLease).not.toBeNull()
    expect(order).toEqual(["second", "third"])
    thirdLease?.release()
    thirdLease?.release()
    await session.drain()
  })

  it("removes a queued cancellation without disturbing the surviving FIFO waiters", async () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    const caller = new AbortController()
    const first = await session.acquire(stamp, caller.signal)
    const cancelled = new AbortController()
    const abandoned = session.acquire(stamp, cancelled.signal)
    const survivor = session.acquire(stamp, caller.signal)
    cancelled.abort()
    expect(await abandoned).toBeNull()
    first?.release()
    const lease = await survivor
    expect(lease).not.toBeNull()
    caller.abort()
    let drained = false
    const drain = session.drain().then(() => {
      drained = true
    })
    await Promise.resolve()
    expect(drained).toBe(false)
    lease?.release()
    await drain
  })

  it("rejects already-aborted, foreign and stale requests without occupying a lease", async () => {
    const session = createMemorySession(sessionIdentity())
    const stale = session.stamp()
    session.invalidate(sessionIdentity())
    const signal = new AbortController().signal
    expect(await session.acquire(stale, signal)).toBeNull()
    expect(await session.acquire(session.stamp(), AbortSignal.abort())).toBeNull()
    const other = createMemorySession(sessionIdentity())
    expect(await session.acquire(other.stamp(), signal)).toBeNull()
    const lease = await session.acquire(session.stamp(), signal)
    expect(lease).not.toBeNull()
    lease?.release()
    await session.drain()
  })

  it.each(["identity", "configuration"])(
    "%s invalidation aborts old waiters but retains the active lease",
    async (change) => {
      const session = createMemorySession(sessionIdentity())
      const stale = session.stamp()
      const signal = new AbortController().signal
      session.acceptConfiguration(stale, "first")
      const active = await session.acquire(stale, signal)
      const queued = session.acquire(stale, signal)
      if (change === "identity") session.invalidate(sessionIdentity())
      else expect(session.acceptConfiguration(stale, "second")).toBe(false)
      expect(await queued).toBeNull()
      let started = false
      const fresh = session.acquire(session.stamp(), signal).then((lease) => {
        started = true
        return lease
      })
      await Promise.resolve()
      expect(started).toBe(false)
      active?.release()
      const next = await fresh
      expect(next).not.toBeNull()
      next?.release()
      await session.drain()
    },
  )

  it("stops new admissions while draining work already queued", async () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    const signal = new AbortController().signal
    const first = await session.acquire(stamp, signal)
    const queued = session.acquire(stamp, signal)
    session.stopAdmissions()
    session.stopAdmissions()
    expect(session.signal(stamp).aborted).toBe(false)
    expect(await session.acquire(stamp, signal)).toBeNull()
    let drained = false
    const drain = session.drain().then(() => {
      drained = true
    })
    first?.release()
    const last = await queued
    expect(last).not.toBeNull()
    expect(drained).toBe(false)
    last?.release()
    await drain
    session.invalidate(sessionIdentity())
    expect(await session.acquire(session.stamp(), signal)).toBeNull()
  })

  it("aborts pending work but drains an already-started critical section, not delayed inference", async () => {
    const session = createMemorySession(sessionIdentity())
    const stamp = session.stamp()
    const write = deferredSessionStep()
    const inference = deferredSessionStep()
    const afterInference = inference.promise.then(() => session.acquire(stamp, new AbortController().signal))
    const active = await session.acquire(stamp, new AbortController().signal)
    const completion = write.promise.then(() => active?.release())
    const queued = session.acquire(stamp, new AbortController().signal)
    session.stopAdmissions()
    session.abortPending()
    expect(session.signal(stamp).aborted).toBe(true)
    expect(await queued).toBeNull()
    let drained = false
    const drain = session.drain().then(() => {
      drained = true
    })
    const repeatedDrain = session.drain()
    await Promise.resolve()
    expect(drained).toBe(false)
    write.resolve()
    await completion
    await drain
    await repeatedDrain
    expect(drained).toBe(true)
    inference.resolve()
    expect(await afterInference).toBeNull()
  })
})
