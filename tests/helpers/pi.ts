import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { DefaultResourceLoader, type ExtensionToolContext, SettingsManager } from "@earendil-works/pi-coding-agent"

import { type MemoryAddResponse, type MemoryAddTool, registerExtension } from "#/pi"

const repoRoot = resolve(import.meta.dirname, "..", "..")

export function registerWithFakePi(env: NodeJS.ProcessEnv) {
  return registerFakePiAt(join("C:", "agent"), env)
}

export function registerFakePiAt(agentDir: string, env: NodeJS.ProcessEnv) {
  const tools: MemoryAddTool[] = []
  const events: string[] = []
  const commands: string[] = []

  const registrar = {
    registerTool: (tool: MemoryAddTool) => tools.push(tool),
    on: (event: string) => events.push(event),
    registerCommand: (name: string) => commands.push(name),
  }
  registerExtension(registrar, agentDir, env)

  return { tools, events, commands }
}

export function fakeToolContext(cwd: string): ExtensionToolContext {
  return {
    cwd,
    mode: "rpc",
    hasUI: false,
    model: undefined,
    scopedModels: [],
    signal: undefined,
    tools: [],
    get ui(): never {
      throw new Error("Unexpected UI access")
    },
    get sessionManager(): never {
      throw new Error("Unexpected session access")
    },
    get modelRegistry(): never {
      throw new Error("Unexpected model access")
    },
    isIdle: () => true,
    isProjectTrusted: () => false,
    abort: () => {
      throw new Error("Unexpected abort")
    },
    hasPendingMessages: () => false,
    shutdown: () => {
      throw new Error("Unexpected shutdown")
    },
    getContextUsage: () => undefined,
    compact: () => {
      throw new Error("Unexpected compaction")
    },
    getSystemPrompt: () => "",
    executeTool: () => {
      throw new Error("Unexpected nested tool call")
    },
  }
}

export async function loadIsolatedPiToolNames(): Promise<string[]> {
  const isolatedAgentDir = await mkdtemp(join(tmpdir(), "pi-smoke-"))
  const previousAutoMemory = process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY
  const loader = new DefaultResourceLoader({
    cwd: isolatedAgentDir,
    agentDir: isolatedAgentDir,
    settingsManager: SettingsManager.inMemory(),
    additionalExtensionPaths: [repoRoot],
    noExtensions: true,
    noSkills: true,
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
    return loaded.extensions.flatMap((extension) => [...extension.tools.keys()])
  } finally {
    if (typeof previousAutoMemory !== "string") {
      delete process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY
    } else {
      process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = previousAutoMemory
    }
    await rm(isolatedAgentDir, { recursive: true, force: true })
  }
}

export function textOf(response: MemoryAddResponse): string {
  const texts = response.content.flatMap((part) => {
    if (part.type === "text") {
      return [part.text]
    }

    return []
  })

  return texts.join("")
}

export function mentionsIn(texts: string[]): string[] {
  return texts.flatMap((text) =>
    [
      ...text.matchAll(/(?<=^|\s)\/[a-z][\w-]*/g),
      ...text.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g),
      ...text.matchAll(/(?<![\w/])memory-\w+/g),
    ].map((mention) => mention[0]),
  )
}

export function unregisteredMentions(texts: string[], registered: string[]): string[] {
  return mentionsIn(texts).filter((mention) => !registered.includes(mention))
}
