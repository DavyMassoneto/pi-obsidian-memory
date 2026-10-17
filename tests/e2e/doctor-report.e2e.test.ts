import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import {
  BLANK_HEADING,
  COMPLETE_SKIPPED,
  COULD_NOT_CHECK,
  CUTOFF_SOURCES,
  DOCTOR_INVALID_HEADING,
  DOCTOR_NO_PROJECT_VAULT,
  DOCTOR_SETUP_HINT,
  DOCTOR_TITLE,
  DUPLICATES_HEADING,
  MODELS_HEADING,
  memoryModelCachePath,
  NO_PROBLEMS,
  TEMPORARIES_HEADING,
} from "#src/pi"
import {
  CAPTURE_OK,
  chooseType,
  configuredWorld,
  E2E_MODEL,
  E2E_PROVIDER,
  memoryReadTree,
  noMemoryWorld,
  noteWithId,
  onlyNotice,
  rewriteConfig,
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

test("a vault with no problems and every provider ready is reported at info level, and nothing is asked", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  await writeVaultFile(world.folders.globalVault, "Good.md", noteWithId(1, "Fine.", []))
  const config = await storedConfig(world)
  const turn = await runDoctor(world, [], 0)
  const notice = onlyNotice(turn)
  const typesafe = CUTOFF_SOURCES.get("typesafe")
  expect(notice.notifyType).toBe("info")
  expect(notice.message).toBe(
    [
      DOCTOR_TITLE,
      "",
      `Global vault: ${NO_PROBLEMS}`,
      "",
      `Project vault: ${NO_PROBLEMS}`,
      "",
      MODELS_HEADING,
      CAPTURE_OK,
      `- memory agent ${E2E_PROVIDER}/${E2E_MODEL}: ok`,
      `- embeddings ${config.embeddings.provider}/${config.embeddings.model}: ready`,
      "- decision model typesafe/jev-latest: ready (model and API key found)",
      `- decision cutoffs: gate 0.5 (${typesafe}), relevance 0.5 (${typesafe})`,
    ].join("\n"),
  )
  expect(world.pi.unexpected).toEqual([])
})

test("a project vault that is missing is a problem for that vault only", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  await writeVaultFile(world.folders.globalVault, "Good.md", noteWithId(1, "Fine.", []))
  await rm(world.folders.projectVault, { recursive: true })
  const { message, notifyType } = onlyNotice(await runDoctor(world, [], 0))
  expect(message).toContain(`Global vault: ${NO_PROBLEMS}`)
  expect(message).toMatch(new RegExp(`Project vault: ${COULD_NOT_CHECK}\\n- .+`))
  expect(notifyType).toBe("warning")
})

test("a folder with no registered project reports only the global vault and says so", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  await rewriteConfig(world, { projects: [] })
  await world.restart()
  const { message } = onlyNotice(await runDoctor(world, [], 0))
  expect(message).toContain(`Global vault: ${NO_PROBLEMS}`)
  expect(message).toContain(DOCTOR_NO_PROJECT_VAULT)
  expect(message).not.toContain("Project vault")
})

test("a memory agent model pi does not know is reported with the model checks", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const config = await storedConfig(world)
  await rewriteConfig(world, { memoryAgent: { ...config.memoryAgent, model: { provider: "other", id: "agent" } } })
  await world.restart()
  const turn = await runDoctor(world, [], 0)
  const report = turn.notifications.filter((notice) => notice.message.startsWith(DOCTOR_TITLE))
  expect(report).toHaveLength(1)
  const { message, notifyType } = onlyNotice({ ...turn, notifications: report })
  expect(message).toContain(CAPTURE_OK)
  expect(message).toContain("- memory agent other/agent: Model other/agent is not registered in pi")
  expect(notifyType).toBe("warning")
})

test("the local embeddings model that is not downloaded yet is reported", async () => {
  const world = await configuredWorld({ capture: "at-session-end", modelCache: "fresh" })
  const { embeddings } = await storedConfig(world)
  await rm(memoryModelCachePath(world.folders.agentDir), { recursive: true, force: true })
  const { message, notifyType } = onlyNotice(await runDoctor(world, [], 0))
  expect(message).toMatch(
    new RegExp(
      `- embeddings ${embeddings.provider}/${embeddings.model}: The local model is not downloaded yet \\(about \\d+ MB\\)`,
    ),
  )
  expect(notifyType).toBe("warning")
})

test("without a config the doctor shows the config problem and says to run /memory-setup", async () => {
  const world = await noMemoryWorld({})
  const { message, notifyType } = onlyNotice(await runDoctor(world, [], 0))
  expect(message.split("\n").at(-1)).toBe(DOCTOR_SETUP_HINT)
  expect(notifyType).toBe("error")
})
