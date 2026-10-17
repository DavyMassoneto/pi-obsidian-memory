import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent"
import Type from "typebox"
import { Value } from "typebox/value"

import { type MemoryPiContext, memoryConfigPath, registrarFor } from "#src/pi"
import { fakePiContext } from "./pi-context.ts"
import { toolCallEvent } from "./pi-prompt.ts"
import { productSettings } from "./settings.ts"
import { useTempFolder } from "./temp-folder.ts"
import type { RegistrarSetup } from "./types.ts"

const repoRoot = resolve(import.meta.dirname, "..", "..")

const BlockedSchema = Type.Object({ block: Type.Literal(true) })

export async function guardedReads(loader: DefaultResourceLoader, agentDir: string, context: MemoryPiContext) {
  const vault = join(agentDir, "smoke-vault")
  await mkdir(vault)
  const config = { global: { vault }, projects: [], ...productSettings() }
  const configPath = memoryConfigPath(agentDir)
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify(config))
  const results = { inside: false, outside: false }
  for (const extension of loader.getExtensions().extensions) {
    const handlers = extension.handlers.get("tool_call")
    if (!handlers) continue
    for (const handler of handlers) {
      const inside = await handler(toolCallEvent("read", { path: join(vault, "Note.md") }), context)
      const outside = await handler(toolCallEvent("read", { path: join(agentDir, "other.txt") }), context)
      if (Value.Check(BlockedSchema, inside)) results.inside = true
      if (Value.Check(BlockedSchema, outside)) results.outside = true
    }
  }
  return results
}

export async function loadWithRegistrar(register: RegistrarSetup) {
  const folder = await useTempFolder()
  const loader = new DefaultResourceLoader({
    cwd: folder,
    agentDir: folder,
    settingsManager: SettingsManager.inMemory(),
    extensionFactories: [(pi) => register(registrarFor(pi))],
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  })
  await loader.reload()
  const loaded = loader.getExtensions()
  if (loaded.errors.length > 0) throw new Error(loaded.errors.map((error) => error.error).join("\n"))
  const [extension] = loaded.extensions
  if (!extension) throw new Error("no extension loaded")
  return { tools: [...extension.tools.keys()], commands: [...extension.commands.keys()], handlers: extension.handlers }
}

export async function loadIsolatedPi() {
  const isolatedAgentDir = await mkdtemp(join(tmpdir(), "pi-smoke-"))
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR
  process.env.PI_CODING_AGENT_DIR = isolatedAgentDir
  const loader = new DefaultResourceLoader({
    cwd: isolatedAgentDir,
    agentDir: isolatedAgentDir,
    settingsManager: SettingsManager.inMemory({ packages: [repoRoot] }),
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  })
  try {
    await loader.reload()
    const loaded = loader.getExtensions()
    if (loaded.errors.length > 0) {
      throw new Error(loaded.errors.map((error) => error.error).join("\n"))
    }
    const { context, notifications } = fakePiContext(isolatedAgentDir, {})
    for (const extension of loaded.extensions) {
      const handlers = extension.handlers.get("session_start")
      if (!handlers) continue
      for (const handler of handlers) await handler({ type: "session_start", reason: "startup" }, context)
    }
    const guarded = await guardedReads(loader, isolatedAgentDir, context)
    return {
      guarded,
      skillNames: loader.getSkills().skills.map((skill) => skill.name),
      toolNames: loaded.extensions.flatMap((extension) => [...extension.tools.keys()]),
      commandNames: loaded.extensions.flatMap((extension) => [...extension.commands.keys()]),
      startNotifications: notifications,
    }
  } finally {
    restoreEnv("PI_CODING_AGENT_DIR", previousAgentDir)
    await rm(isolatedAgentDir, { recursive: true, force: true })
  }
}

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous !== "string") {
    delete process.env[name]
  } else {
    process.env[name] = previous
  }
}
