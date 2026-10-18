import { expect, test } from "vitest"

import {
  BLANK_HEADING,
  COMPLETE_SKIPPED,
  DOCTOR_INVALID_HEADING,
  DUPLICATES_HEADING,
  NO_PROBLEMS,
  TEMPORARIES_HEADING,
} from "#src/pi"
import {
  chooseType,
  configuredWorld,
  memoryReadTree,
  noteWithId,
  runDoctor,
  storedConfig,
  writeVaultFile,
} from "#test-helpers"

test("one report names the broken note, the copies, the blank note, the temporary file and the crowded folder, and nothing changes on disk", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const { globalVault, projectVault } = world.folders
  await writeVaultFile(globalVault, "tools/Broken.md", "---\nid: nope\n---\nBody.")
  await writeVaultFile(globalVault, "Copy one.md", noteWithId(7, "Same id.", []))
  await writeVaultFile(globalVault, "Copy two.md", noteWithId(7, "Same id again.", []))
  await writeVaultFile(globalVault, "Blank.md", "")
  await writeVaultFile(globalVault, "tools/Half.md.tmp-abc", "half")
  for (let number = 0; number < 21; number += 1)
    await writeVaultFile(globalVault, `crowded/Note ${number}.md`, noteWithId(100 + number, `Note ${number}.`, []))
  const before = [await memoryReadTree(globalVault), await memoryReadTree(projectVault)]
  const turn = await runDoctor(world, [chooseType("global/Blank.md", { cancelled: true })], 1)
  const [report, skipped] = turn.notifications
  expect(report?.notifyType).toBe("warning")
  expect(report?.message).toContain(`${DOCTOR_INVALID_HEADING}\n- tools/Broken.md:`)
  expect(report?.message).toMatch(
    new RegExp(`${DUPLICATES_HEADING}\\n- \\w{26}: Copy (one|two)\\.md, Copy (one|two)\\.md`),
  )
  expect(report?.message).toContain(`${BLANK_HEADING}\n- Blank.md`)
  expect(report?.message).toContain(`${TEMPORARIES_HEADING}\n- tools/Half.md.tmp-abc`)
  const { maxNotesPerFolder } = (await storedConfig(world)).limits
  expect(report?.message).toContain(
    `Folders above ${maxNotesPerFolder} notes (consider splitting them):\n- crowded: 21 notes`,
  )
  expect(report?.message).toContain(`Project vault: ${NO_PROBLEMS}`)
  expect(skipped?.message).toBe(`${COMPLETE_SKIPPED} global/Blank.md`)
  expect(turn.notifications).toHaveLength(2)
  expect([await memoryReadTree(globalVault), await memoryReadTree(projectVault)]).toEqual(before)
  expect(world.pi.unexpected).toEqual([])
})
