import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import type { MemoryGetParams, MemorySearchParams } from "#src/pi"
import { textOf } from "./pi.ts"
import { fakePiContext } from "./pi-context.ts"
import { fakeToolContext, toolCallEvent } from "./pi-prompt.ts"
import { piRegistrationFixture, writeAgentConfig } from "./pi-registration.ts"

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
