import { describe, expect, it } from "vitest"

import { refreshFolders } from "#src/services"
import {
  aLimits,
  folderRefreshProcess,
  keepGoing,
  numberedNote,
  putNumberedNote,
  readIndexOf,
  useTempFolder,
} from "#test-helpers"

const ADDED_NOTES = 25
const TRANSIENT_WINDOWS_ERROR = /EPERM|EACCES|EBUSY/

describe("concurrent folder refresh", () => {
  it("two processes refreshing the same folder never throw and leave a complete index.md while a third reads it", async () => {
    const vault = await useTempFolder()
    await putNumberedNote(vault, "topic", 0)
    const context = { path: vault, name: "Memory", limits: aLimits() }
    expect(await refreshFolders(context, ["topic"], keepGoing, "with-ancestors")).toMatchObject({ succeeded: true })
    const processes = [
      folderRefreshProcess("refresher", vault, "topic"),
      folderRefreshProcess("refresher", vault, "topic"),
      folderRefreshProcess("reader", vault, "topic"),
    ]
    await Promise.all(processes.map((running) => running.ready))

    for (let position = 1; position <= ADDED_NOTES; position += 1) {
      await putNumberedNote(vault, "topic", position)
    }
    const tallies = await Promise.all(processes.map((running) => running.stopped()))

    for (const tally of tallies) {
      expect(tally.runs).toBeGreaterThan(0)
      expect(tally.incomplete).toBe(0)
      for (const problem of tally.problems) expect(problem).toMatch(TRANSIENT_WINDOWS_ERROR)
    }
    const last = await refreshFolders(context, ["topic"], keepGoing, "with-ancestors")
    expect(last).toMatchObject({ succeeded: true })
    const index = await readIndexOf(vault, "topic")
    for (let position = 0; position <= ADDED_NOTES; position += 1) {
      expect(index).toContain(numberedNote(position).statement)
    }
  })
})
