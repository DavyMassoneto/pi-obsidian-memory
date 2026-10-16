import { readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test, vi } from "vitest"

import { exportablePiFixture, fakePiContext, piRegistrationFixture } from "#test-helpers"

test("a blank folder means the working folder and a blank name the default name", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 20, 10, 5, 7))
  const { pi, workingFolder } = await exportablePiFixture()
  const { context, notifications, prompts } = fakePiContext(workingFolder, { answers: { inputs: ["", ""] } })

  await pi.runCommand("memory-export", context)
  vi.useRealTimers()

  expect(await readdir(workingFolder)).toContain("memory-export-2026-10-20-100507.zip")
  expect(prompts.map((prompt) => prompt.message)).toEqual([workingFolder, "memory-export-2026-10-20-100507.zip"])
  expect(notifications).toEqual([
    { message: expect.stringContaining(join(workingFolder, "memory-export-2026-10-20-100507.zip")), type: "info" },
  ])
})

test("a chosen folder and name are used", async () => {
  const { pi, workingFolder, out } = await exportablePiFixture()
  const { context } = fakePiContext(workingFolder, { answers: { inputs: [out, "mine.zip"] } })

  await pi.runCommand("memory-export", context)

  expect(await readdir(out)).toEqual(["mine.zip"])
})

test("a taken name is refused, never overwritten, and asked again", async () => {
  const { pi, workingFolder, out } = await exportablePiFixture()
  await writeFile(join(out, "mine.zip"), "precious")
  const { context, notifications } = fakePiContext(workingFolder, {
    answers: { inputs: [out, "mine.zip", "other.zip"] },
  })

  await pi.runCommand("memory-export", context)

  expect((await readdir(out)).sort()).toEqual(["mine.zip", "other.zip"])
  expect(notifications.map((entry) => entry.type)).toEqual(["error", "info"])
  expect(notifications[0]?.message).toContain("mine.zip")
})

test("cancelling at either question changes nothing", async () => {
  const { pi, workingFolder, out } = await exportablePiFixture()
  const folderCancelled = fakePiContext(workingFolder, { answers: { inputs: [undefined] } })
  const nameCancelled = fakePiContext(workingFolder, { answers: { inputs: [out, undefined] } })

  await pi.runCommand("memory-export", folderCancelled.context)
  await pi.runCommand("memory-export", nameCancelled.context)

  expect(await readdir(out)).toEqual([])
  expect(folderCancelled.notifications).toEqual([{ message: "Export cancelled: nothing was written.", type: "info" }])
  expect(nameCancelled.notifications).toEqual([{ message: "Export cancelled: nothing was written.", type: "info" }])
})

test("a folder inside a vault is refused with the reason", async () => {
  const { pi, workingFolder, vaults } = await exportablePiFixture()
  const { context, notifications } = fakePiContext(workingFolder, {
    answers: { inputs: [vaults.global.path, "x.zip"] },
  })

  await pi.runCommand("memory-export", context)

  expect(notifications).toEqual([{ message: expect.stringContaining("inside a vault"), type: "error" }])
  expect(await readdir(vaults.global.path)).not.toContain("x.zip")
})

test("without a config the export says to run /memory-setup", async () => {
  const { pi, workingFolder } = await piRegistrationFixture()
  const { context, notifications } = fakePiContext(workingFolder, { answers: { inputs: ["", ""] } })

  await pi.runCommand("memory-export", context)

  expect(notifications).toEqual([{ message: expect.stringContaining("/memory-setup"), type: "error" }])
})

test("without a UI nothing is asked or written", async () => {
  const { pi, workingFolder } = await exportablePiFixture()
  const { context, prompts, notifications } = fakePiContext(workingFolder, { hasUI: false })

  await pi.runCommand("memory-export", context)

  expect(prompts).toEqual([])
  expect(notifications).toEqual([])
  expect(await readdir(workingFolder)).toEqual([])
})
