import type { TurnEndEvent } from "@earendil-works/pi-coding-agent"

export function toolCallCount(message: TurnEndEvent["message"]): number {
  if (message.role !== "assistant") return 0
  return message.content.filter((block) => block.type === "toolCall").length
}
