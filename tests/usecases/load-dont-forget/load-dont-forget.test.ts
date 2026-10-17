import { mkdir, rename, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, onTestFinished, test, vi } from "vitest"

import { loadDontForget } from "#src/usecases"
import {
  expectRegistrationLeaseReleased,
  memoryReadFixture,
  noteWithId,
  putCatalogFile,
  searchFixture,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("a marked note comes back in full and an unmarked one does not", async () => {
  const { vault, context } = await searchFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", ["dontForget: true"]))
  await putCatalogFile(vault, "tools/Plain.md", noteWithId(2, "Nothing special.", []))

  const result = await loadDontForget(context)

  expect(result).toEqual({
    succeeded: true,
    output: {
      vaults: [
        {
          vault: "global",
          notes: [
            {
              vault: "global",
              path: "tools/Use pnpm.md",
              type: "rule",
              id: "01JABCDE7XKQ2M9V3RTN8WPZ01",
              hash: expect.stringMatching(/^[a-f0-9]{64}$/),
              statement: "Use pnpm",
              body: "Always pnpm.",
              problems: [],
            },
          ],
          problems: [],
        },
        { vault: "project", notes: [], problems: [] },
      ],
    },
  })
  await expectRegistrationLeaseReleased(context)
})

test("a marked note drops out once archived", async () => {
  const { vault, context } = await searchFixture()
  await putCatalogFile(vault, "Keep.md", noteWithId(1, "Keep it.", ["dontForget: true"]))
  expect(await loadDontForget(context)).toMatchObject({ output: { vaults: [{ notes: [{ path: "Keep.md" }] }, {}] } })

  await mkdir(join(vault.path, "archive"))
  await rename(join(vault.path, "Keep.md"), join(vault.path, "archive/Keep.md"))

  expect(await loadDontForget(context)).toMatchObject({ output: { vaults: [{ notes: [] }, { notes: [] }] } })
})

test("a marked note whose body is over a lowered limit is loaded with its problems", async () => {
  const { vault, context, config } = await searchFixture()
  await putCatalogFile(vault, "Long.md", noteWithId(1, "A body that is too long.", ["dontForget: true"]))
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, limits: { ...config.limits, maxBodyChars: 5 } }))

  const result = await loadDontForget(context)

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      vaults: [
        { notes: [{ path: "Long.md", body: "A body that is too long.", problems: [expect.stringContaining("body")] }] },
        {},
      ],
    },
  })
})

test("a marked note with invalid frontmatter is not loaded", async () => {
  const { vault, context } = await searchFixture()
  await putCatalogFile(vault, "Broken.md", noteWithId(1, "Broken.", ["dontForget: true", "colour: red"]))

  expect(await loadDontForget(context)).toMatchObject({ output: { vaults: [{ notes: [] }, { notes: [] }] } })
})

test("both vaults are covered", async () => {
  const { vault, project, context } = await searchFixture()
  await putCatalogFile(vault, "Global.md", noteWithId(1, "Global.", ["dontForget: true"]))
  await putCatalogFile(project, "Project.md", noteWithId(2, "Project.", ["dontForget: true"]))

  expect(await loadDontForget(context)).toMatchObject({
    output: {
      vaults: [
        { vault: "global", notes: [{ vault: "global", path: "Global.md" }] },
        { vault: "project", notes: [{ vault: "project", path: "Project.md" }] },
      ],
    },
  })
})

test("without a project only the global vault is read", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Global.md", noteWithId(1, "Global.", ["dontForget: true"]))

  expect(await loadDontForget(context)).toMatchObject({
    succeeded: true,
    output: { vaults: [{ vault: "global", notes: [{ path: "Global.md" }] }] },
  })
})

test("a vault that cannot be read reports its problems while the other vault still loads", async () => {
  const { vault, project, context } = await searchFixture()
  await putCatalogFile(vault, "Global.md", noteWithId(1, "Global.", ["dontForget: true"]))
  await rm(project.path, { recursive: true })

  const result = await loadDontForget(context)

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      vaults: [
        { vault: "global", notes: [{ path: "Global.md" }], problems: [] },
        { vault: "project", notes: [], problems: [expect.any(String)] },
      ],
    },
  })
})

test("without a config nothing is loaded", async () => {
  const { context } = await searchFixture()
  await rm(context.configPath)

  expect(await loadDontForget(context)).toMatchObject({ succeeded: false, reason: "not-configured" })
  await expectRegistrationLeaseReleased(context)
})

test("a load waiting for a busy memory keeps waiting and stops when the signal aborts", async () => {
  const { context, controller } = await searchFixture()
  const lease = await context.session.acquire(context.stamp, new AbortController().signal)
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    lease?.release()
    vi.useRealTimers()
  })
  let settled = false

  const pending = loadDontForget(context).finally(() => {
    settled = true
  })
  await vi.advanceTimersByTimeAsync(10 * 60_000)
  expect(settled).toBe(false)
  controller.abort()

  expect(await pending).toMatchObject({ succeeded: false, reason: "cancelled" })
})
