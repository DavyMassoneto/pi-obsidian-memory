import { join } from "node:path"

import type { BeforeAgentStartEvent, SessionStartEvent, ToolCallEvent } from "@earendil-works/pi-coding-agent"

import {
  type AgentEndHandler,
  type BeforeAgentStartHandler,
  type BeforeCompactHandler,
  type CursorData,
  type ExtensionOverrides,
  type ExtensionRegistrar,
  type MemoryAddTool,
  type MemoryArchiveTool,
  type MemoryCommand,
  type MemoryGetTool,
  type MemoryPiContext,
  type MemorySearchTool,
  type MemorySucceedTool,
  type MemoryUpdateTool,
  registerExtension,
  type SessionShutdownHandler,
  type SessionStartHandler,
  type ToolCallHandler,
} from "#src/pi"
import { fakePiContext } from "./pi-context.ts"
import { promptEventFor } from "./pi-prompt.ts"
import type { TurnOutcome } from "./types.ts"

export function registerWithFakePi(env: NodeJS.ProcessEnv) {
  return registerFakePiAt(join("C:", "agent"), env)
}

export function registerFakePiAt(agentDir: string, env: NodeJS.ProcessEnv, overrides?: ExtensionOverrides) {
  const tools: MemoryAddTool[] = []
  const searchTools: MemorySearchTool[] = []
  const getTools: MemoryGetTool[] = []
  const updateTools: MemoryUpdateTool[] = []
  const archiveTools: MemoryArchiveTool[] = []
  const succeedTools: MemorySucceedTool[] = []
  const registered: string[] = []
  const promptHandlers: BeforeAgentStartHandler[] = []
  const events: string[] = []
  const commands: string[] = []
  const commandHandlers = new Map<string, MemoryCommand["handler"]>()
  const startHandlers: SessionStartHandler[] = []
  const shutdownHandlers: SessionShutdownHandler[] = []
  const toolCallHandlers: ToolCallHandler[] = []
  const agentEndHandlers: AgentEndHandler[] = []
  const compactHandlers: BeforeCompactHandler[] = []
  const cursors: CursorData[] = []
  const failures = { cursor: false }

  const registrar: ExtensionRegistrar = {
    registerAddTool(tool) {
      registered.push(tool.name)
      tools.push(tool)
    },
    registerSearchTool(tool) {
      registered.push(tool.name)
      searchTools.push(tool)
    },
    registerGetTool(tool) {
      registered.push(tool.name)
      getTools.push(tool)
    },
    registerUpdateTool(tool) {
      registered.push(tool.name)
      updateTools.push(tool)
    },
    registerArchiveTool(tool) {
      registered.push(tool.name)
      archiveTools.push(tool)
    },
    registerSucceedTool(tool) {
      registered.push(tool.name)
      succeedTools.push(tool)
    },
    onBeforeAgentStart(handler) {
      events.push("before_agent_start")
      promptHandlers.push(handler)
    },
    registerCommand(name, command) {
      commands.push(name)
      commandHandlers.set(name, command.handler)
    },
    onSessionStart(handler) {
      events.push("session_start")
      startHandlers.push(handler)
    },
    onAgentEnd(handler) {
      events.push("agent_end")
      agentEndHandlers.push(handler)
    },
    onBeforeCompact(handler) {
      events.push("session_before_compact")
      compactHandlers.push(handler)
    },
    appendCursor(data) {
      if (failures.cursor) throw new Error("cursor refused")
      cursors.push(data)
    },
    onToolCall(handler) {
      events.push("tool_call")
      toolCallHandlers.push(handler)
    },
    onSessionShutdown(handler) {
      events.push("session_shutdown")
      shutdownHandlers.push(handler)
    },
  }
  registerExtension(registrar, agentDir, env, overrides)

  return {
    tools,
    searchTools,
    getTools,
    updateTools,
    archiveTools,
    succeedTools,
    registered,
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
    async runPrompt(cwd: string): Promise<BeforeAgentStartEvent["systemPromptOptions"]["sections"]> {
      const event = promptEventFor(cwd, "hello")
      const { context } = fakePiContext(cwd, { hasUI: false })
      for (const handler of promptHandlers) await handler(event, context)
      return event.systemPromptOptions.sections
    },
    async runTurn(context: MemoryPiContext, prompt: string): Promise<TurnOutcome> {
      const event = promptEventFor(context.cwd, prompt)
      let message: TurnOutcome["message"] = null
      for (const handler of promptHandlers) {
        const result = await handler(event, context)
        if (result?.message) message = result.message
      }
      return { sections: event.systemPromptOptions.sections, message }
    },
    async runToolCall(event: ToolCallEvent, context: MemoryPiContext) {
      for (const handler of toolCallHandlers) {
        const result = await handler(event, context)
        if (result) return result
      }
      return undefined
    },
    async shutdownSession(context: MemoryPiContext) {
      for (const handler of shutdownHandlers) await handler({ type: "session_shutdown", reason: "quit" }, context)
    },
    async endAgent(context: MemoryPiContext) {
      for (const handler of agentEndHandlers) await handler({ type: "agent_end", messages: [] }, context)
    },
    async compact(context: MemoryPiContext) {
      for (const handler of compactHandlers)
        await handler({ type: "session_before_compact", reason: "manual" }, context)
    },
    cursors,
    failures,
  }
}
