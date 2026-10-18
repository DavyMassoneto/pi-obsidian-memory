import { writeFile } from "node:fs/promises"

import { expect, test } from "vitest"

import { INVALID_CONFIG_NOTICE, REPAIR_TITLE, SETTINGS_TITLE, STATUS_LOADING } from "#src/pi"
import {
  configText,
  dialogsTitled,
  e2eWorld,
  leaveScreen,
  noticeTexts,
  settingsScreen,
  statusCleared,
  storedConfig,
} from "#test-helpers"

test("a config file that still says capture.when starts with memory on, no repair notice, and is left as it was", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "after-each-turn" })
  const { capture, ...rest } = await storedConfig(world)
  const legacy = JSON.stringify({ ...rest, capture: { model: capture.model, when: "at-session-end" } })
  await writeFile(world.folders.configPath, legacy)
  await world.restart()
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), 0)
  const screen = await settingsScreen(world, [leaveScreen])
  expect(noticeTexts(world, 0).join("\n")).not.toContain(INVALID_CONFIG_NOTICE)
  expect(dialogsTitled(world, REPAIR_TITLE)).toEqual([])
  expect(dialogsTitled(world, SETTINGS_TITLE)[0]?.options).toEqual(
    expect.arrayContaining(["Review during the session: off", "Flush at compaction: off", "Flush at session end: on"]),
  )
  expect(screen.notifications).toEqual([])
  expect(await configText(world)).toBe(legacy)
  expect(world.pi.unexpected).toEqual([])
})
