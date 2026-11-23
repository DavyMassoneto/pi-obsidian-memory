import { readFileSync } from "node:fs"

import { parseSessionEntries, SessionManager, type SessionMessageEntry } from "@earendil-works/pi-coding-agent"

import { recordsOf } from "#src/pi"
import { CONSOLIDATED_TYPE, localTimestamp, OBSERVATIONS_TYPE, USER_WORDS_TYPE } from "#src/usecases"
import { E2E_MODEL, E2E_PROVIDER } from "./e2e-paths.ts"

const FIRST_LABEL = "For this example, use amber as the label."
const SECOND_LABEL = "For this example, use violet instead of amber."

export interface UserWordsSeed {
  file: string
  first: string
  second: string
  tail: string
  firstWords: string
  ghost: string
  occupiedId: string
  abandonedId: string
  displacedId: string
  timestamps: [number, number]
  tailTimestamp: number
}

function appendUser(session: SessionManager, content: string, timestamp: number): string {
  return session.appendMessage({ role: "user", content, timestamp })
}

function savedUser(file: string, id: string): SessionMessageEntry {
  for (const entry of parseSessionEntries(readFileSync(file, "utf8"))) {
    if (entry.type === "message" && entry.id === id && entry.message.role === "user") return entry
  }
  throw new Error("The seed has no persisted user entry for this source ID")
}

export function seedUserWordsSession(cwd: string, sessionDir: string): UserWordsSeed {
  const session = SessionManager.create(cwd, sessionDir)
  session.appendModelChange(E2E_PROVIDER, E2E_MODEL)
  const startOfSecond = Math.floor(Date.now() / 1000) * 1000
  const first = appendUser(session, FIRST_LABEL, startOfSecond)
  const second = appendUser(session, SECOND_LABEL, startOfSecond + 1)
  const file = session.getSessionFile()
  if (!file) throw new Error("The native session did not save a session filename")
  const when = localTimestamp(startOfSecond)
  const occupiedId = `${when}.900`
  const abandonedId = `${when}.001`
  const displacedId = `${when}.002`
  session.appendCustomEntry(OBSERVATIONS_TYPE, { fromId: first, coversUpToId: second, observations: [] })
  const firstWords = session.appendCustomEntry(USER_WORDS_TYPE, {
    entryId: first,
    passages: [{ kind: "message", quote: FIRST_LABEL }],
  })
  const ghost = session.appendCustomEntry(CONSOLIDATED_TYPE, { observationIds: [abandonedId], journey: "" })

  const tail = appendUser(session, "This is the end of the example. Reply only ACK.", startOfSecond + 1000)
  session.appendCustomEntry(OBSERVATIONS_TYPE, { fromId: tail, coversUpToId: tail, observations: [] })
  const firstTime = savedUser(file, first).message.timestamp
  const secondTime = savedUser(file, second).message.timestamp
  const tailTimestamp = savedUser(file, tail).message.timestamp
  if (firstTime !== startOfSecond || secondTime !== startOfSecond + 1 || tailTimestamp !== startOfSecond + 1000) {
    throw new Error("The native session did not persist the three declared message timestamps")
  }
  return {
    file,
    first,
    second,
    tail,
    firstWords,
    ghost,
    occupiedId,
    abandonedId,
    displacedId,
    timestamps: [firstTime, secondTime],
    tailTimestamp,
  }
}

export function userWordsHistory(file: string) {
  return recordsOf(SessionManager.open(file).getBranch())
}

export function userWordsChatRuns(file: string) {
  return SessionManager.open(file)
    .getBranch()
    .flatMap((entry) => {
      if (entry.type !== "message" || entry.message.role !== "assistant") return []
      const { provider, model, stopReason } = entry.message
      return [{ id: entry.id, provider, model, stopReason }]
    })
}
