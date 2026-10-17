import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { CAPTURE_FAILED, CURSOR_TYPE } from "#src/pi"
import { callsOf, e2eWorld, endOf, NotifySchema, recordsOf, toolCallPrompt } from "#test-helpers"

const savedNotes = 21

test("capturing a session that saved more than 20 notes reviews them and moves the cursor", async () => {
  const world = await e2eWorld({
    memory: "configured",
    tools: [],
    modelCache: "shared",
    capture: "at-session-end",
    session: "saved",
  })
  for (let number = 1; number <= savedNotes; number += 1) {
    const add = {
      scope: "global",
      folder: "bulk",
      statement: `Rule number ${number}`,
      type: "rule",
      body: `Rule number ${number} is kept.`,
      dontForget: false,
    }
    const added = await world.pi.prompt(toolCallPrompt("memory_add", JSON.stringify(add)), [])
    expect(callsOf(added, "memory_add")).toBe(1)
    expect(endOf(added, "memory_add").isError).toBe(false)
  }
  const notes = await readdir(join(world.folders.globalVault, "bulk"))
  expect(notes.filter((name) => name.startsWith("Rule number "))).toHaveLength(savedNotes)

  const sessionFile = await world.pi.sessionFile()
  const from = world.pi.lines.length
  await world.pi.newSession()

  const failures = recordsOf(NotifySchema, world.pi.lines.slice(from)).filter((notice) =>
    notice.message.startsWith(CAPTURE_FAILED),
  )
  expect(failures.map((notice) => notice.message)).toEqual([])
  expect(await readFile(sessionFile, "utf8")).toContain(`"customType":"${CURSOR_TYPE}"`)
})
