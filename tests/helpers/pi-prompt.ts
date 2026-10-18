import type { ToolCallEvent } from "@earendil-works/pi-coding-agent"

export function toolCallEvent(toolName: string, input: ToolCallEvent["input"]): ToolCallEvent {
  return { type: "tool_call", toolCallId: "call-guard", toolName, input }
}
