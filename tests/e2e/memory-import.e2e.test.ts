import { expect, test } from "vitest"

import { IMPORT_DONE, MEMORY_IMPORT_COMMAND } from "#src/pi"
import { NO_PROJECT_TO_IMPORT_INTO } from "#src/usecases"
import {
  configuredWorld,
  ExtensionErrorSchema,
  folderSnapshot,
  IMPORT_SETTLES,
  notesOfBothVaults,
  notifiedWith,
  OM_IMPORTED_FILES,
  omFolderOf,
  onlyNotice,
  recordsOf,
  rewriteConfig,
  savedTodayNoteShape,
  writeOmMemory,
} from "#test-helpers"

test("the import turns what OM saved into valid notes, leaves .memory as it was and names the file count", async () => {
  const world = await configuredWorld({})
  await writeOmMemory(world)
  const omBefore = await folderSnapshot(omFolderOf(world))
  const notesBefore = (await notesOfBothVaults(world)).map((note) => note.path)

  const turn = await world.pi.command(`/${MEMORY_IMPORT_COMMAND}`, [], IMPORT_SETTLES)

  const [done] = notifiedWith(turn, `${IMPORT_DONE} ${OM_IMPORTED_FILES} file(s) from `)
  if (typeof done !== "string") throw new Error(`no import notice in ${JSON.stringify(turn.notifications)}`)
  expect(done).toContain(".memory")
  const changes = done.match(/: (\d+) change\(s\) to the vaults\.$/)
  if (!changes) throw new Error(`the notice does not end with the change count: ${done}`)
  expect(Number(changes[1])).toBeGreaterThan(0)
  const added = (await notesOfBothVaults(world)).filter((note) => !notesBefore.includes(note.path))
  expect(added.length).toBeGreaterThan(0)
  for (const note of added) expect(note.text).toMatch(savedTodayNoteShape())
  expect(await folderSnapshot(omFolderOf(world))).toEqual(omBefore)
  expect(world.pi.unexpected).toEqual([])
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
})

test("a folder with no project vault is told to run /memory-init, and the vaults and .memory stay as they were", async () => {
  const world = await configuredWorld({})
  await rewriteConfig(world, { projects: [] })
  await writeOmMemory(world)
  const omBefore = await folderSnapshot(omFolderOf(world))
  const globalBefore = await folderSnapshot(world.folders.globalVault)
  const projectBefore = await folderSnapshot(world.folders.projectVault)

  const turn = await world.pi.command(`/${MEMORY_IMPORT_COMMAND}`, [], IMPORT_SETTLES)

  const notice = onlyNotice(turn)
  expect(notice.notifyType).toBe("error")
  expect(notice.message).toBe(NO_PROJECT_TO_IMPORT_INTO)
  expect(await folderSnapshot(omFolderOf(world))).toEqual(omBefore)
  expect(await folderSnapshot(world.folders.globalVault)).toEqual(globalBefore)
  expect(await folderSnapshot(world.folders.projectVault)).toEqual(projectBefore)
  expect(world.pi.unexpected).toEqual([])
})
