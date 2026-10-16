import type { BeforeAgentStartEvent, ExtensionToolContext, ToolCallEvent } from "@earendil-works/pi-coding-agent"

export function promptEvent(cwd: string): BeforeAgentStartEvent {
  return {
    type: "before_agent_start",
    prompt: "hello",
    systemPrompt: "",
    systemPromptOptions: {
      cwd,
      selectedTools: [],
      toolSnippets: {},
      toolGuidelines: {},
      promptGuidelines: [],
      appendSystemPrompt: "",
      sections: {},
      contextFiles: [],
      skills: [],
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

export function toolCallEvent(toolName: string, input: ToolCallEvent["input"]): ToolCallEvent {
  return { type: "tool_call", toolCallId: "call-guard", toolName, input }
}
