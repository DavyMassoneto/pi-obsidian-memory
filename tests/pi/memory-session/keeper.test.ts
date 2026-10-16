import { expect, test } from "vitest"

import { MemorySessionKeeper, SemanticRuntime } from "#src/pi"
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

test("a tool call has no operation context before a session started", () => {
  expect(new MemorySessionKeeper().currentOperation("work", paths, undefined)).toBeNull()
})

test("a tool call gets the current stamp and stops when its own signal aborts", () => {
  const keeper = new MemorySessionKeeper()
  const { context } = fakePiContext("work", {})
  const session = keeper.start(context)
  const controller = new AbortController()

  const operation = keeper.currentOperation("work", paths, controller.signal)

  expect(operation).toMatchObject({ configPath: "config.json", indexPath: "index", workingFolder: "work", session })
  expect(operation?.stamp).toBe(session.stamp())
  expect(operation?.signal.aborted).toBe(false)
  controller.abort()
  expect(operation?.signal.aborted).toBe(true)
})

test("a tool call context stops when the session ends", () => {
  const keeper = new MemorySessionKeeper()
  const { context } = fakePiContext("work", {})
  keeper.start(context)
  const operation = keeper.currentOperation("work", paths, undefined)

  keeper.shutdown()

  expect(operation?.signal.aborted).toBe(true)
  expect(keeper.currentOperation("work", paths, undefined)).toBeNull()
})

test("a keeper with a semantic runtime gives every operation its source, and one without gives none", () => {
  const runtime = new SemanticRuntime("models")
  const { context } = fakePiContext("work", {})
  const withRuntime = new MemorySessionKeeper(runtime)
  const without = new MemorySessionKeeper()

  const session = withRuntime.start(context)

  expect(withRuntime.operationContext(session, "work", paths, undefined).semantic).toBe(runtime.source)
  expect(withRuntime.registrationFlow(context, paths).registration).toMatchObject({ semantic: runtime.source })
  expect(without.operationContext(without.start(context), "work", paths, undefined)).not.toHaveProperty("semantic")
})

test("starting a session attaches its UI to the semantic runtime", async () => {
  const runtime = new SemanticRuntime("models")
  const { context, prompts } = fakePiContext("work", { apiKeys: ["openai"], answers: { confirms: [true] } })

  new MemorySessionKeeper(runtime).start(context)
  const port = await runtime.source({ provider: "openai", model: "text-embedding-3-small" })

  expect(port).toMatchObject({ available: true })
  expect(prompts).toHaveLength(1)
})
