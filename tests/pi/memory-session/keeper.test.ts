import { expect, test } from "vitest"

import { MemorySessionKeeper } from "#src/pi"
import { fakePiContext } from "#test-helpers"

const paths = { configPath: "config.json", indexPath: "index" }

test("the registration flow carries the paths, the working folder and a current stamp", () => {
  const keeper = new MemorySessionKeeper()
  const { context } = fakePiContext("work", { sessionId: "session-x" })

  const { session, registration } = keeper.registrationFlow(context, paths)

  expect(registration).toMatchObject({ configPath: "config.json", indexPath: "index", workingFolder: "work" })
  expect(registration.stamp.sessionId).toBe("session-x")
  expect(session.isCurrent(registration.stamp)).toBe(true)
  expect(registration.signal.aborted).toBe(false)
})

test("the flow reuses the session started for the pi session", () => {
  const keeper = new MemorySessionKeeper()
  const { context } = fakePiContext("work", {})
  const started = keeper.start(context)

  expect(keeper.registrationFlow(context, paths).session).toBe(started)
})

test("starting a new session aborts the previous one", () => {
  const keeper = new MemorySessionKeeper()
  const { context } = fakePiContext("work", {})
  const { session, registration } = keeper.registrationFlow(context, paths)

  const next = keeper.start(context)

  expect(next).not.toBe(session)
  expect(session.isCurrent(registration.stamp)).toBe(false)
  expect(registration.signal.aborted).toBe(true)
  expect(next.isCurrent(next.stamp())).toBe(true)
})

test("shutdown aborts the session and a later flow starts a fresh one", () => {
  const keeper = new MemorySessionKeeper()
  const { context } = fakePiContext("work", {})
  const { session, registration } = keeper.registrationFlow(context, paths)

  keeper.shutdown()

  expect(registration.signal.aborted).toBe(true)
  const fresh = keeper.registrationFlow(context, paths)
  expect(fresh.session).not.toBe(session)
  expect(fresh.session.isCurrent(fresh.registration.stamp)).toBe(true)
})
