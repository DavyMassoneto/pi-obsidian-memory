import { expect, test } from "vitest"

import { saveChange } from "#src/pi"
import { settingsEnv } from "#test-helpers"

test("a saved change is said in one info notice, without the reload note when nothing waits for it", async () => {
  const { env, notifications } = await settingsEnv()

  const saved = await saveChange(env, {
    change: { kind: "budgetChars", value: 500 },
    what: "budget is 500",
    reload: false,
  })

  expect(saved).toBe(true)
  expect(notifications).toEqual([{ message: "Saved: budget is 500.", type: "info" }])
})

test("a change that waits for /reload says so in its notice", async () => {
  const { env, notifications } = await settingsEnv()

  await saveChange(env, { change: { kind: "budgetChars", value: 500 }, what: "budget is 500", reload: true })

  expect(notifications[0]?.message).toMatch(/^Saved: budget is 500\.\n.*\/reload/)
})

test("a refused change is an error notice with its problem and saves nothing", async () => {
  const { env, notifications } = await settingsEnv()

  const saved = await saveChange(env, { change: { kind: "budgetChars", value: 0 }, what: "budget is 0", reload: true })

  expect(saved).toBe(false)
  expect(notifications).toEqual([{ message: expect.stringContaining("budgetChars"), type: "error" }])
})
