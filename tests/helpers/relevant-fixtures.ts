import type { ReadObservation } from "#src/services"
import { observeRead } from "#src/usecases"
import { fakePiContext } from "./pi-context.ts"
import { FINISH_WITH_READS, getNote, putNote, relevantFixture } from "./relevant-memory.ts"
import { relevantPiFixture } from "./relevant-pi.ts"
import type { RelevantPiOptions } from "./types.ts"

export async function startedPiFixture(options: RelevantPiOptions, hasUI: boolean) {
  const fixture = await relevantPiFixture(options)
  await putNote(fixture.vaults.global, "Use pnpm", 1, "Always pnpm.")
  await putNote(fixture.vaults.global, "Use npm", 2, "Plain npm.")
  const fake = fakePiContext(fixture.workingFolder, { hasUI, answers: { confirms: [true] } })
  return { ...fixture, ...fake }
}

export async function agentFixture() {
  const fixture = await relevantFixture({ laya: null })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const yarn = await putNote(fixture.vault, "Use yarn", 2, "Yarn for the old repo.")
  const request = {
    agent: { project: "loja", folder: fixture.context.workingFolder },
    query: "package managers",
    model: fixture.config.memoryAgent.model,
    deadline: Date.now() + 60_000,
  }
  return { ...fixture, pnpm, yarn, request }
}

export async function layaLimits(fixture: Awaited<ReturnType<typeof relevantFixture>>) {
  return { deadlineMs: Date.now() + 5000, signal: fixture.context.signal }
}

export function readNote(path: string, hash: string): ReadObservation {
  return {
    kind: "read",
    vault: "global",
    path,
    id: "01JABCDE7XKQ2M9V3RTN8WPZ01",
    hash: hash.repeat(64),
    statement: "Use pnpm",
    body: "Always pnpm.",
    type: "rule",
    dontForget: false,
  }
}

export async function loadedFixture() {
  const fixture = await relevantFixture({ laya: null })
  const path = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const read = await observeRead({ vault: "global", path }, fixture.context)
  if (typeof read === "string") throw new Error(read)
  fixture.loaded.remember(read)
  return { ...fixture, path }
}

export async function threeNotes(fixture: Awaited<ReturnType<typeof relevantFixture>>) {
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const yarn = await putNote(fixture.vault, "Use yarn", 2, "Yarn for the old repo.")
  const npm = await putNote(fixture.vault, "Use npm", 3, "Plain npm.")
  return [getNote(yarn), getNote(npm), getNote(pnpm), FINISH_WITH_READS]
}
