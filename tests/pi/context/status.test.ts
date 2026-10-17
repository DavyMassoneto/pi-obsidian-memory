import { expect, test } from "vitest"

import { STATUS_CAPTURING, STATUS_LOADING, STATUS_SEARCHING, withMemoryStatus } from "#src/pi"
import { fakePiContext } from "#test-helpers"

test("the status is set while the work runs, cleared when it ends, and the result is returned", async () => {
  const { context, statuses } = fakePiContext("work", { hasUI: true })

  const result = await withMemoryStatus(context, STATUS_LOADING, async () => {
    expect(statuses).toEqual([{ key: STATUS_LOADING.key, text: STATUS_LOADING.text }])
    return "done"
  })

  expect(result).toBe("done")
  expect(statuses).toEqual([
    { key: STATUS_LOADING.key, text: STATUS_LOADING.text },
    { key: STATUS_LOADING.key, text: undefined },
  ])
})

test("the status is cleared and the error still reaches the caller when the work fails", async () => {
  const { context, statuses } = fakePiContext("work", { hasUI: true })

  await expect(
    withMemoryStatus(context, STATUS_SEARCHING, async () => {
      throw new Error("boom")
    }),
  ).rejects.toThrow("boom")

  expect(statuses.at(-1)).toEqual({ key: STATUS_SEARCHING.key, text: undefined })
})

test("without a UI the work runs and no status is set", async () => {
  const { context, statuses } = fakePiContext("work", { hasUI: false })

  expect(await withMemoryStatus(context, STATUS_CAPTURING, async () => 7)).toBe(7)
  expect(statuses).toEqual([])
})

test("each step has its own key, so a step that ends first leaves the others showing", async () => {
  const { context, statuses } = fakePiContext("work", { hasUI: true })
  const loading = Promise.withResolvers<void>()
  const capturing = Promise.withResolvers<void>()

  const first = withMemoryStatus(context, STATUS_LOADING, () => loading.promise)
  const second = withMemoryStatus(context, STATUS_CAPTURING, () => capturing.promise)
  loading.resolve()
  await first

  expect(new Set([STATUS_LOADING.key, STATUS_SEARCHING.key, STATUS_CAPTURING.key]).size).toBe(3)
  const live = new Map<string, string | undefined>()
  for (const { key, text } of statuses) live.set(key, text)
  expect([...live.entries()].filter(([, text]) => typeof text === "string")).toEqual([
    [STATUS_CAPTURING.key, STATUS_CAPTURING.text],
  ])
  capturing.resolve()
  await second
})
