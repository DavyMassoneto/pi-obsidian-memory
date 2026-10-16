import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import type {
  MemoryArchiveParams,
  MemoryGetParams,
  MemorySearchParams,
  MemorySucceedParams,
  MemoryUpdateParams,
} from "#src/pi"
import { READIED_PATH } from "./memory-change.ts"
import { textOf } from "./pi.ts"
import { fakePiContext } from "./pi-context.ts"
import { fakeToolContext, toolCallEvent } from "./pi-prompt.ts"
import { piRegistrationFixture, writeAgentConfig } from "./pi-registration.ts"
import { noteWithId } from "./search-memory.ts"
import { putCatalogFile } from "./vault-catalog.ts"

export async function piMemoryFixture() {
  const fixture = await piRegistrationFixture()
  const projectVault = join(fixture.root, "Loja memory")
  await mkdir(fixture.globalVault)
  await mkdir(projectVault)
  const config = {
    ...fixture.config,
    projects: [{ name: "loja", folder: fixture.workingFolder, vault: projectVault }],
  }
  await writeAgentConfig(fixture.configPath, JSON.stringify(config))
  const { context } = fakePiContext(fixture.workingFolder, { hasUI: false })
  const vaults = {
    global: { path: fixture.globalVault, limits: config.limits },
    project: { path: projectVault, limits: config.limits },
  }
  return { ...fixture, config, projectVault, vaults, piContext: context }
}

type MemoryFixture = Pick<Awaited<ReturnType<typeof piMemoryFixture>>, "pi" | "workingFolder">

export async function piGlobalOnlyFixture() {
  const fixture = await piRegistrationFixture()
  await mkdir(fixture.globalVault)
  await writeAgentConfig(fixture.configPath, JSON.stringify(fixture.config))
  const { context } = fakePiContext(fixture.workingFolder, { hasUI: false })
  return { ...fixture, piContext: context }
}

export async function piUnconfiguredFixture() {
  const fixture = await piRegistrationFixture()
  const { context } = fakePiContext(fixture.workingFolder, { hasUI: false })
  return { ...fixture, piContext: context }
}

export async function searchResponse(fixture: MemoryFixture, params: MemorySearchParams) {
  const tool = fixture.pi.searchTools[0]
  if (!tool) throw new Error("memory_search not registered")
  return tool.execute("call-search", params, undefined, undefined, fakeToolContext(fixture.workingFolder))
}

export async function searchedText(fixture: MemoryFixture, params: MemorySearchParams): Promise<string> {
  return textOf(await searchResponse(fixture, params))
}

export async function readText(fixture: MemoryFixture, params: MemoryGetParams) {
  const tool = fixture.pi.getTools[0]
  if (!tool) throw new Error("memory_get not registered")
  return tool.execute("call-get", params, undefined, undefined, fakeToolContext(fixture.workingFolder))
}

export async function vaultRefusalText(): Promise<string> {
  const fixture = await piMemoryFixture()
  const blocked = await fixture.pi.runToolCall(
    toolCallEvent("read", { path: join(fixture.globalVault, "Note.md") }),
    fixture.piContext,
  )
  if (!blocked || typeof blocked.reason !== "string") throw new Error("vault path was not blocked")
  return blocked.reason
}

export async function updateResponse(fixture: MemoryFixture, params: MemoryUpdateParams) {
  const tool = fixture.pi.updateTools[0]
  if (!tool) throw new Error("memory_update not registered")
  return tool.execute("call-update", params, undefined, undefined, fakeToolContext(fixture.workingFolder))
}

export async function archiveResponse(fixture: MemoryFixture, params: MemoryArchiveParams) {
  const tool = fixture.pi.archiveTools[0]
  if (!tool) throw new Error("memory_archive not registered")
  return tool.execute("call-archive", params, undefined, undefined, fakeToolContext(fixture.workingFolder))
}

export async function succeedResponse(fixture: MemoryFixture, params: MemorySucceedParams) {
  const tool = fixture.pi.succeedTools[0]
  if (!tool) throw new Error("memory_succeed not registered")
  return tool.execute("call-succeed", params, undefined, undefined, fakeToolContext(fixture.workingFolder))
}

export async function readiedPiNote() {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, READIED_PATH, noteWithId(1, "Always pnpm.", []))
  await fixture.pi.startSession(fixture.piContext, "startup")
  await readText(fixture, { vault: "global", path: READIED_PATH })
  return { ...fixture, file: join(fixture.vaults.global.path, READIED_PATH) }
}
