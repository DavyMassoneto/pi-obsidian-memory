import { mkdir, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  expectRegistrationLeaseReleased,
  exportFixture,
  exportMemory,
  holdFileContentsLocked,
  isExported,
  memoryReadTree,
  noteWithId,
  putCatalogFile,
  unzipArchive,
} from "#test-helpers"

test("the archive unpacks to each vault's files under global/ and project/, without hidden or temporary files", async () => {
  const { context, vault, project, destination, root } = await exportFixture()
  const globalBefore = await memoryReadTree(vault.path)
  const projectBefore = await memoryReadTree(project.path)

  const result = await exportMemory({ folder: destination, fileName: "memory-export.zip" }, context)

  expect(result).toMatchObject({ succeeded: true, output: { path: join(destination, "memory-export.zip") } })
  const unpacked = join(root, "unpacked")
  await unzipArchive(join(destination, "memory-export.zip"), unpacked)
  expect(await memoryReadTree(join(unpacked, "global"))).toEqual(globalBefore.filter(isExported))
  expect(await memoryReadTree(join(unpacked, "project"))).toEqual(projectBefore.filter(isExported))
  expect(await readFile(join(unpacked, "global", "attachments", "diagram.png"))).toEqual(
    Buffer.from([137, 80, 78, 71, 0, 255, 1]),
  )
  expect(await readdir(join(unpacked, "global"))).toEqual(
    expect.arrayContaining(["Memory.base", "_templates", "archive", "index.md", "tools", "attachments"]),
  )
  await expectRegistrationLeaseReleased(context)
})

test("the vaults are not changed by the export", async () => {
  const { context, vault, project, destination } = await exportFixture()
  const before = [await memoryReadTree(vault.path), await memoryReadTree(project.path)]

  await exportMemory({ folder: destination, fileName: "memory-export.zip" }, context)

  expect([await memoryReadTree(vault.path), await memoryReadTree(project.path)]).toEqual(before)
})

test("without a registered project only global/ is exported", async () => {
  const { context, destination, root } = await exportFixture()

  const result = await exportMemory(
    { folder: destination, fileName: "global-only.zip" },
    { ...context, workingFolder: root },
  )

  expect(result.succeeded).toBe(true)
  const unpacked = join(root, "unpacked")
  await unzipArchive(join(destination, "global-only.zip"), unpacked)
  expect(await readdir(unpacked)).toEqual(["global"])
})

test("a second export to the same folder keeps both files, and an existing name is refused without touching it", async () => {
  const { context, destination } = await exportFixture()

  await exportMemory({ folder: destination, fileName: "one.zip" }, context)
  const first = await readFile(join(destination, "one.zip"))
  const taken = await exportMemory({ folder: destination, fileName: "one.zip" }, context)
  const second = await exportMemory({ folder: destination, fileName: "two.zip" }, context)

  expect(taken).toMatchObject({ succeeded: false, reason: "exists" })
  expect(second.succeeded).toBe(true)
  expect((await readdir(destination)).sort()).toEqual(["one.zip", "two.zip"])
  expect(await readFile(join(destination, "one.zip"))).toEqual(first)
})

test.each(["", "../out.zip", "sub/out.zip", String.raw`sub\out.zip`, "out.txt", "."])(
  "the file name %j is refused before anything is written",
  async (fileName) => {
    const { context, destination } = await exportFixture()

    const result = await exportMemory({ folder: destination, fileName }, context)

    expect(result).toMatchObject({ succeeded: false, reason: "invalid" })
    expect(await readdir(destination)).toEqual([])
  },
)

test("a missing folder is refused", async () => {
  const { context, root } = await exportFixture()

  const result = await exportMemory({ folder: join(root, "nowhere"), fileName: "out.zip" }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "not-found" })
})

test("a folder inside a vault is refused so the export never changes a vault", async () => {
  const { context, vault } = await exportFixture()

  const result = await exportMemory({ folder: join(vault.path, "tools"), fileName: "out.zip" }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "inside-vault" })
  expect(await readdir(join(vault.path, "tools"))).not.toContain("out.zip")
})

test("an unreadable file refuses the whole export and writes nothing", async () => {
  const { context, vault, destination } = await exportFixture()
  await putCatalogFile(vault, "tools/Locked.md", noteWithId(4, "Locked.", []))
  const release = await holdFileContentsLocked(join(vault.path, "tools", "Locked.md"))

  const result = await exportMemory({ folder: destination, fileName: "out.zip" }, context)
  await release()

  expect(result).toMatchObject({ succeeded: false, reason: "unreadable-files" })
  expect(await readdir(destination)).toEqual([])
})

test("without a config the export is refused", async () => {
  const { context, destination } = await exportFixture()

  const result = await exportMemory(
    { folder: destination, fileName: "out.zip" },
    { ...context, configPath: join(destination, "none.json") },
  )

  expect(result.succeeded).toBe(false)
  expect(await readdir(destination)).toEqual([])
})

test("a typed relative folder is resolved against the working folder, not the process folder", async () => {
  const { context, root } = await exportFixture()
  await mkdir(join(context.workingFolder, "out"))

  const result = await exportMemory({ folder: "out", fileName: "relative.zip" }, context)

  expect(result).toMatchObject({
    succeeded: true,
    output: { path: join(context.workingFolder, "out", "relative.zip") },
  })
  expect(await readdir(join(context.workingFolder, "out"))).toEqual(["relative.zip"])
  expect(await readdir(root)).not.toContain("relative.zip")
})

test("a note whose name has accents and other non-ASCII letters survives the round trip", async () => {
  const { context, destination, root } = await exportFixture()

  await exportMemory({ folder: destination, fileName: "accents.zip" }, context)
  await unzipArchive(join(destination, "accents.zip"), join(root, "unpacked"))

  expect(await readdir(join(root, "unpacked", "global"))).toContain("Ação é.md")
  expect(await readFile(join(root, "unpacked", "global", "Ação é.md"), "utf8")).toContain("Accents.")
})
