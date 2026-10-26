import { expect, test } from "vitest"

import { MEMORY_DOCTOR_COMMAND, MEMORY_EXPORT_COMMAND, MEMORY_INIT_COMMAND, MEMORY_SETUP_COMMAND } from "#src/pi"
import {
  callMemoryToolOnce,
  e2eWorld,
  expectedNoteText,
  folderSnapshot,
  inDayWindow,
  memoryNote,
  memoryNoteAt,
  noteTextAt,
  omnirouteSyncPackageFolder,
  vaultNotes,
} from "#test-helpers"

test("installed through settings.json packages, pi lists the four memory commands and the obsidian-memory skill from the package", async () => {
  const world = await e2eWorld({
    memory: "none",
    tools: [],
    modelCache: "fresh",
    installed: true,
  })
  const commands = await world.pi.commands()
  const fromPackage = expect.objectContaining({ origin: "package" })
  for (const name of [MEMORY_SETUP_COMMAND, MEMORY_INIT_COMMAND, MEMORY_EXPORT_COMMAND, MEMORY_DOCTOR_COMMAND]) {
    expect(commands).toContainEqual(expect.objectContaining({ name, source: "extension", sourceInfo: fromPackage }))
  }
  expect(commands).toContainEqual(
    expect.objectContaining({ name: "skill:obsidian-memory", source: "skill", sourceInfo: fromPackage }),
  )
})

test("installed, the six memory tools each run once on a Haiku turn, and pi writes nothing into the OmniRoute package", async () => {
  const authFolder = omnirouteSyncPackageFolder()
  const authBefore = await folderSnapshot(authFolder)
  const world = await e2eWorld({
    memory: "configured",
    tools: [],
    modelCache: "shared",
    installed: true,
  })
  const { globalVault } = world.folders
  expect(await vaultNotes(globalVault)).toEqual([])
  const addedOn = async (letter: string) =>
    inDayWindow(() => callMemoryToolOnce(world, "memory_add", JSON.stringify(memoryNote(letter))))
  const addedA = await addedOn("A")
  const addedB = await addedOn("B")
  const addedC = await addedOn("C")
  await callMemoryToolOnce(world, "memory_search", JSON.stringify({ query: "pnpm", vault: "global" }))
  for (const letter of ["A", "B", "C"]) {
    await callMemoryToolOnce(world, "memory_get", JSON.stringify(memoryNoteAt(letter)))
  }
  const update = { ...memoryNoteAt("A"), body: "Body A changed." }
  const updatedOn = await inDayWindow(() => callMemoryToolOnce(world, "memory_update", JSON.stringify(update)))
  const { scope: _scope, ...successorNote } = memoryNote("D")
  const successor = { ...memoryNoteAt("B"), ...successorNote }
  const succeededOn = await inDayWindow(() => callMemoryToolOnce(world, "memory_succeed", JSON.stringify(successor)))
  const archivedOn = await inDayWindow(() =>
    callMemoryToolOnce(world, "memory_archive", JSON.stringify(memoryNoteAt("C"))),
  )
  expect(await folderSnapshot(authFolder)).toEqual(authBefore)
  const notes = await vaultNotes(globalVault)
  expect(notes.map((entry) => entry.path).sort()).toEqual([
    "archive/tools/Note B says pnpm.md",
    "archive/tools/Note C says pnpm.md",
    "tools/Note A says pnpm.md",
    "tools/Note D says pnpm.md",
  ])
  const { type } = successorNote
  const textOf = (path: string) => noteTextAt(notes, path)
  const a = textOf("tools/Note A says pnpm.md")
  expect(a).toBe(expectedNoteText(a, { type, body: update.body, created: addedA, updated: updatedOn }))
  const b = textOf("archive/tools/Note B says pnpm.md")
  const replacedBy = "[[tools/Note D says pnpm]]"
  expect(b).toBe(
    expectedNoteText(b, {
      type,
      body: memoryNote("B").body,
      created: addedB,
      updated: addedB,
      archived: succeededOn,
      replacedBy,
    }),
  )
  const d = textOf("tools/Note D says pnpm.md")
  const replaces = "[[archive/tools/Note B says pnpm]]"
  expect(d).toBe(
    expectedNoteText(d, { type, body: successorNote.body, created: succeededOn, updated: succeededOn, replaces }),
  )
  const c = textOf("archive/tools/Note C says pnpm.md")
  expect(c).toBe(
    expectedNoteText(c, { type, body: memoryNote("C").body, created: addedC, updated: addedC, archived: archivedOn }),
  )
})
