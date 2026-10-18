import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { EXPORT_DONE, EXPORT_FOLDER_TITLE, EXPORT_NAME_TITLE, MEMORY_EXPORT_COMMAND } from "#src/pi"
import {
  DEFAULT_EXPORT_NAME,
  dialogsTitled,
  EXPORT_SETTLES,
  expectZipHoldsBothVaults,
  exportableWorld,
  exportFolderStep,
  exportNameStep,
  localToday,
  onlyNotice,
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
