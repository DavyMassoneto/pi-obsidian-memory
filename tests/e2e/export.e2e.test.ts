import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  EXPORT_CANCELLED,
  EXPORT_DONE,
  EXPORT_FOLDER_TITLE,
  EXPORT_NAME_TAKEN,
  EXPORT_NAME_TITLE,
  EXPORT_SETUP_HINT,
  MEMORY_EXPORT_COMMAND,
} from "#src/pi"
import {
  DEFAULT_EXPORT_NAME,
  dialogsTitled,
  EXPORT_SETTLES,
  expectZipHoldsBothVaults,
  exportableWorld,
  exportFolderStep,
  exportNameStep,
  localToday,
  noMemoryWorld,
  nth,
  onlyNotice,
  outFolder,
} from "#test-helpers"

test("a blank folder means the working folder and a blank name the default name with today's date", async () => {
  const world = await exportableWorld()
  const turn = await world.pi.command(
    `/${MEMORY_EXPORT_COMMAND}`,
    [exportFolderStep({ value: "" }), exportNameStep({ value: "" })],
    EXPORT_SETTLES,
  )
  const [zipName, ...others] = (await readdir(world.folders.cwd)).filter((name) => name.endsWith(".zip"))
  if (typeof zipName !== "string" || others.length > 0)
    throw new Error("expected exactly one zip in the working folder")
  expect(zipName).toMatch(DEFAULT_EXPORT_NAME)
  expect(zipName.startsWith(`memory-export-${localToday()}-`)).toBe(true)
  expect(dialogsTitled(world, EXPORT_FOLDER_TITLE).map((dialog) => dialog.placeholder)).toEqual([world.folders.cwd])
  expect(dialogsTitled(world, EXPORT_NAME_TITLE).map((dialog) => dialog.placeholder)).toEqual([zipName])
  const notice = onlyNotice(turn)
  expect(notice.notifyType).toBe("info")
  const zipPath = join(world.folders.cwd, zipName)
  const files = await expectZipHoldsBothVaults(world, zipPath)
  expect(notice.message).toBe(`${EXPORT_DONE} ${files} files from global and project to ${zipPath}`)
  expect(world.pi.unexpected).toEqual([])
})

test("a chosen folder and name are used, and the zip holds both vaults' notes unchanged", async () => {
  const world = await exportableWorld()
  const out = await outFolder(world)
  const turn = await world.pi.command(
    `/${MEMORY_EXPORT_COMMAND}`,
    [exportFolderStep({ value: out }), exportNameStep({ value: "mine.zip" })],
    EXPORT_SETTLES,
  )
  expect(await readdir(out)).toEqual(["mine.zip"])
  const zipPath = join(out, "mine.zip")
  const files = await expectZipHoldsBothVaults(world, zipPath)
  expect(onlyNotice(turn).message).toBe(`${EXPORT_DONE} ${files} files from global and project to ${zipPath}`)
})

test("a taken name is refused, never overwritten, and asked again", async () => {
  const world = await exportableWorld()
  const out = await outFolder(world)
  await writeFile(join(out, "mine.zip"), "precious")
  const turn = await world.pi.command(
    `/${MEMORY_EXPORT_COMMAND}`,
    [exportFolderStep({ value: out }), exportNameStep({ value: "mine.zip" }), exportNameStep({ value: "other.zip" })],
    nth(EXPORT_SETTLES, 2),
  )
  expect((await readdir(out)).sort()).toEqual(["mine.zip", "other.zip"])
  expect(await readFile(join(out, "mine.zip"), "utf8")).toBe("precious")
  const files = await expectZipHoldsBothVaults(world, join(out, "other.zip"))
  expect(turn.notifications.map((notice) => [notice.message, notice.notifyType])).toEqual([
    [`mine.zip ${EXPORT_NAME_TAKEN}`, "error"],
    [`${EXPORT_DONE} ${files} files from global and project to ${join(out, "other.zip")}`, "info"],
  ])
})

test("cancelling at either question writes nothing", async () => {
  const world = await exportableWorld()
  const out = await outFolder(world)
  const noFolder = await world.pi.command(
    `/${MEMORY_EXPORT_COMMAND}`,
    [exportFolderStep({ cancelled: true })],
    EXPORT_SETTLES,
  )
  const noName = await world.pi.command(
    `/${MEMORY_EXPORT_COMMAND}`,
    [exportFolderStep({ value: out }), exportNameStep({ cancelled: true })],
    EXPORT_SETTLES,
  )
  for (const turn of [noFolder, noName])
    expect(turn.notifications.map((notice) => [notice.message, notice.notifyType])).toEqual([
      [EXPORT_CANCELLED, "info"],
    ])
  expect(await readdir(out)).toEqual([])
  expect((await readdir(world.folders.cwd)).filter((name) => name.endsWith(".zip"))).toEqual([])
})

test("a folder inside a vault is refused with the reason, and nothing is written there", async () => {
  const world = await exportableWorld()
  const { globalVault } = world.folders
  const before = await readdir(globalVault)
  const turn = await world.pi.command(
    `/${MEMORY_EXPORT_COMMAND}`,
    [exportFolderStep({ value: globalVault }), exportNameStep({ value: "x.zip" })],
    EXPORT_SETTLES,
  )
  expect(turn.notifications.map((notice) => [notice.message, notice.notifyType])).toEqual([
    [`${globalVault} is inside a vault; choose another folder`, "error"],
  ])
  expect(await readdir(globalVault)).toEqual(before)
})

test("without a config the export says to run /memory-setup", async () => {
  const world = await noMemoryWorld({})
  const turn = await world.pi.command(
    `/${MEMORY_EXPORT_COMMAND}`,
    [exportFolderStep({ value: "" }), exportNameStep({ value: "" })],
    EXPORT_SETTLES,
  )
  const notice = onlyNotice(turn)
  expect(notice.notifyType).toBe("error")
  expect(notice.message.split("\n").at(-1)).toBe(EXPORT_SETUP_HINT)
  expect((await readdir(world.folders.cwd)).filter((name) => name.endsWith(".zip"))).toEqual([])
})
