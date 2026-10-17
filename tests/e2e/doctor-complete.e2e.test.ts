import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { BLANK_HEADING, COMPLETE_SKIPPED, COMPLETED, DOCTOR_TITLE, MEMORY_DOCTOR_COMMAND } from "#src/pi"
import {
  BLANK_LABEL,
  BLANK_PATH,
  blankFile,
  chooseType,
  confirmCompletion,
  dialogTitled,
  localToday,
  memoryReadTree,
  notifySettles,
  runDoctor,
  typeBody,
  ULID_LINE,
  worldWithBlank,
  writeVaultFile,
} from "#test-helpers"

test("an empty blank note is reported, then completed with the chosen type and typed body after the user confirms", async () => {
  const world = await worldWithBlank("")
  const otherBefore = await readFile(join(world.folders.globalVault, "tools/Other.md"), "utf8")
  const turn = await runDoctor(
    world,
    [
      chooseType(BLANK_LABEL, { option: "lesson" }),
      typeBody(BLANK_LABEL, { value: "Learned this." }),
      confirmCompletion(BLANK_LABEL, "lesson", true),
    ],
    1,
  )
  const [report, completed] = turn.notifications
  expect(report?.message).toContain(`${BLANK_HEADING}\n- ${BLANK_PATH}`)
  expect(report?.notifyType).toBe("warning")
  expect(completed).toEqual(
    expect.objectContaining({ message: `${COMPLETED} ${BLANK_LABEL} as a lesson note.`, notifyType: "info" }),
  )
  expect(turn.notifications).toHaveLength(2)
  const text = await blankFile(world)
  expect(text).toMatch(
    new RegExp(
      `^---\\n${ULID_LINE.source.slice(1, -1)}\\ntype: lesson\\ncreated: ${localToday()}\\nupdated: ${localToday()}\\n---\\n`,
    ),
  )
  expect(text).toContain("Learned this.")
  expect(await readFile(join(world.folders.globalVault, "tools/Other.md"), "utf8")).toBe(otherBefore)
  expect(world.pi.unexpected).toEqual([])
})

test("a blank note with text keeps its text as the body and the doctor asks no body", async () => {
  const world = await worldWithBlank("What the user typed")
  const turn = await runDoctor(
    world,
    [chooseType(BLANK_LABEL, { option: "fact" }), confirmCompletion(BLANK_LABEL, "fact", true)],
    1,
  )
  expect(turn.notifications.map((notice) => notice.message).at(-1)).toBe(`${COMPLETED} ${BLANK_LABEL} as a fact note.`)
  const text = await blankFile(world)
  expect(text).toContain("type: fact")
  expect(text).toContain("What the user typed")
  expect(world.pi.unexpected).toEqual([])
})

test("declining the confirmation leaves every file in both vaults exactly as it was", async () => {
  const world = await worldWithBlank("")
  const before = [await memoryReadTree(world.folders.globalVault), await memoryReadTree(world.folders.projectVault)]
  const turn = await runDoctor(
    world,
    [
      chooseType(BLANK_LABEL, { option: "lesson" }),
      typeBody(BLANK_LABEL, { value: "Learned this." }),
      confirmCompletion(BLANK_LABEL, "lesson", false),
    ],
    1,
  )
  expect(turn.notifications.map((notice) => notice.message).at(-1)).toBe(`${COMPLETE_SKIPPED} ${BLANK_LABEL}`)
  expect(await blankFile(world)).toBe("")
  expect([await memoryReadTree(world.folders.globalVault), await memoryReadTree(world.folders.projectVault)]).toEqual(
    before,
  )
})

test("cancelling the type, or the body, leaves the file as it was", async () => {
  const world = await worldWithBlank("")
  const noType = await runDoctor(world, [chooseType(BLANK_LABEL, { cancelled: true })], 1)
  const noBody = await runDoctor(
    world,
    [chooseType(BLANK_LABEL, { option: "lesson" }), typeBody(BLANK_LABEL, { cancelled: true })],
    1,
  )
  expect(noType.notifications.map((notice) => notice.message)).toEqual([
    expect.stringContaining(DOCTOR_TITLE),
    `${COMPLETE_SKIPPED} ${BLANK_LABEL}`,
  ])
  expect(noBody.notifications.map((notice) => notice.message).at(-1)).toBe(`${COMPLETE_SKIPPED} ${BLANK_LABEL}`)
  expect(await blankFile(world)).toBe("")
  expect(world.pi.unexpected).toEqual([])
})

test("an empty body typed for an empty note is not completed", async () => {
  const world = await worldWithBlank("")
  const turn = await runDoctor(
    world,
    [chooseType(BLANK_LABEL, { option: "fact" }), typeBody(BLANK_LABEL, { value: "  " })],
    1,
  )
  expect(turn.notifications.map((notice) => notice.message).at(-1)).toBe(`${COMPLETE_SKIPPED} ${BLANK_LABEL}`)
  expect(turn.notifications).toHaveLength(2)
  expect(await blankFile(world)).toBe("")
})

test("a note the user edits after the report is refused and keeps the edit", async () => {
  const world = await worldWithBlank("")
  await world.pi.beginCommand(
    `/${MEMORY_DOCTOR_COMMAND}`,
    [
      chooseType(BLANK_LABEL, { option: "fact" }),
      typeBody(BLANK_LABEL, { value: "Mine." }),
      { ...confirmCompletion(BLANK_LABEL, "fact", true), answer: { open: true } },
    ],
    dialogTitled("as a fact note?"),
  )
  await writeVaultFile(world.folders.globalVault, BLANK_PATH, "The user typed this meanwhile")
  const from = world.pi.lines.length
  world.pi.answerOpen({ confirmed: true })
  await world.pi.waitFor(notifySettles([COMPLETED]), from)
  const turn = await world.pi.endCommand()
  expect(turn.notifications.map((notice) => [notice.message, notice.notifyType]).at(-1)).toEqual([
    "The blank file changed since its preview",
    "error",
  ])
  expect(await blankFile(world)).toBe("The user typed this meanwhile")
})
