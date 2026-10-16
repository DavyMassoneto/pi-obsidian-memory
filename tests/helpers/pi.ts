import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import {
  DefaultResourceLoader,
  type ExtensionToolContext,
  type SessionStartEvent,
  SettingsManager,
} from "@earendil-works/pi-coding-agent"

import {
  type ExtensionRegistrar,
  type MemoryAddResponse,
  type MemoryAddTool,
  type MemoryCommand,
  type MemoryPiContext,
  registerExtension,
  type SessionShutdownHandler,
  type SessionStartHandler,
} from "#src/pi"
import { fakePiContext } from "./pi-context.ts"

const repoRoot = resolve(import.meta.dirname, "..", "..")

export function registerWithFakePi(env: NodeJS.ProcessEnv) {
  return registerFakePiAt(join("C:", "agent"), env)
}

export function registerFakePiAt(agentDir: string, env: NodeJS.ProcessEnv) {
  const tools: MemoryAddTool[] = []
  const events: string[] = []
  const commands: string[] = []
  const commandHandlers = new Map<string, MemoryCommand["handler"]>()
  const startHandlers: SessionStartHandler[] = []
  const shutdownHandlers: SessionShutdownHandler[] = []

  const registrar: ExtensionRegistrar = {
    registerTool: (tool) => tools.push(tool),
    registerCommand(name, command) {
      commands.push(name)
      commandHandlers.set(name, command.handler)
    },
    onSessionStart(handler) {
      events.push("session_start")
      startHandlers.push(handler)
    },
    onSessionShutdown(handler) {
      events.push("session_shutdown")
      shutdownHandlers.push(handler)
    },
  }
  registerExtension(registrar, agentDir, env)

  return {
    tools,
    events,
    commands,
    async runCommand(name: string, context: MemoryPiContext) {
      const handler = commandHandlers.get(name)
      if (!handler) throw new Error(`command not registered: ${name}`)
      await handler("", context)
    },
    async startSession(context: MemoryPiContext, reason: SessionStartEvent["reason"]) {
      for (const handler of startHandlers) await handler({ type: "session_start", reason }, context)
    },
    async shutdownSession() {
      for (const handler of shutdownHandlers) await handler()
    },
  }
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

export async function loadIsolatedPi() {
  const isolatedAgentDir = await mkdtemp(join(tmpdir(), "pi-smoke-"))
  const previousAutoMemory = process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR
  process.env.PI_CODING_AGENT_DIR = isolatedAgentDir
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
    const { context, notifications } = fakePiContext(isolatedAgentDir, {})
    for (const extension of loaded.extensions) {
      const handlers = extension.handlers.get("session_start")
      if (!handlers) continue
      for (const handler of handlers) await handler({ type: "session_start", reason: "startup" }, context)
    }
    return {
      toolNames: loaded.extensions.flatMap((extension) => [...extension.tools.keys()]),
      commandNames: loaded.extensions.flatMap((extension) => [...extension.commands.keys()]),
      startNotifications: notifications,
    }
  } finally {
    restoreEnv("CLAUDE_CODE_DISABLE_AUTO_MEMORY", previousAutoMemory)
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
