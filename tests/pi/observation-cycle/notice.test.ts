import { setTimeout as sleep } from "node:timers/promises"

import { expect, test } from "vitest"

import {
  consolidatedNotice,
  consolidatorStartedNotice,
  NoticeQueue,
  type NoticeTarget,
  observerSavedNotice,
  observerStartedNotice,
  rectifiedNotice,
  uncheckedNotice,
} from "#src/pi"

interface Told {
  message: string
  level: string | undefined
}

function target(hasUI: boolean, told: Told[]): NoticeTarget {
  return { hasUI, ui: { notify: (message, level) => void told.push({ message, level }) } }
}

test("each notice names what the cycle did, with its counts", () => {
  expect(observerStartedNotice(2)).toBe("Memory observer started: 2 chunk(s).")
  expect(observerSavedNotice(7)).toBe("Memory observer saved 7 observation(s).")
  expect(consolidatorStartedNotice(12, 5400, 0)).toBe(
    "Memory consolidator started: 12 observation(s), about 5400 tokens.",
  )
  expect(consolidatorStartedNotice(0, 0, 5)).toBe(
    "Memory consolidator started: correcting what it wrote from 5 earlier observation(s) that were not the user's.",
  )
  expect(consolidatedNotice(12, 3)).toBe("Memory consolidated: 12 observation(s), 3 change(s) to the vaults.")
  expect(rectifiedNotice(9, 7, 0)).toBe(
    "Memory checked the origin of 9 observation(s): 7 came from material the assistant read, not from the user.",
  )
  expect(rectifiedNotice(6, 0, 6)).toBe("6 observation(s) remain unconfirmed and are not saved as notes.")
  expect(rectifiedNotice(4, 1, 2)).toBe(
    "Memory checked the origin of 2 observation(s): 1 came from material the assistant read, not from the user. 2 observation(s) remain unconfirmed and are not saved as notes.",
  )
  expect(uncheckedNotice(6)).toBe(
    "Memory could not check the origin of 6 observation(s) after 3 attempts: they stay marked as unconfirmed and are not saved as notes.",
  )
})

test("notices queued in the same tick reach the user as one notice, a line each, in order", async () => {
  const told: Told[] = []
  const queue = new NoticeQueue()
  queue.add(target(true, told), observerSavedNotice(3))
  queue.add(target(true, told), observerSavedNotice(5))
  expect(told).toEqual([])
  await sleep(20)
  expect(told).toEqual([
    { message: "Memory observer saved 3 observation(s).\nMemory observer saved 5 observation(s).", level: "info" },
  ])
  queue.add(target(true, told), observerSavedNotice(1))
  await sleep(20)
  expect(told.map((notice) => notice.message).at(-1)).toBe("Memory observer saved 1 observation(s).")
  expect(told.length).toBe(2)
})

test("a cleared queue and a session with no UI tell nothing", async () => {
  const told: Told[] = []
  const queue = new NoticeQueue()
  queue.add(target(true, told), observerSavedNotice(3))
  queue.clear()
  queue.add(target(false, told), observerSavedNotice(4))
  await sleep(20)
  expect(told).toEqual([])
})
