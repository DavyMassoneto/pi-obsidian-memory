import Type, { type Static } from "typebox"
import { Value } from "typebox/value"

import {
  DialogRequestSchema,
  type RecordTest,
  type RpcTurn,
  recordOf,
  StatusSchema,
  type ToolEnd,
} from "./e2e-records.ts"

const TextPartSchema = Type.Object({ type: Type.String(), text: Type.Optional(Type.String()) })

export const CustomMessageSchema = Type.Object({
  role: Type.Literal("custom"),
  customType: Type.String(),
  content: Type.Union([Type.String(), Type.Array(TextPartSchema)]),
})

export const MessagesResponseSchema = Type.Object({
  type: Type.Literal("response"),
  command: Type.Literal("get_messages"),
  data: Type.Object({ messages: Type.Array(Type.Object({ role: Type.String() })) }),
})

export type ListedMessage = Static<typeof MessagesResponseSchema>["data"]["messages"][number]

export function customTexts(messages: ListedMessage[], customType: string): string[] {
  return messages.flatMap((message) => {
    if (!Value.Check(CustomMessageSchema, message) || message.customType !== customType) return []
    if (typeof message.content === "string") return [message.content]
    return [
      message.content
        .flatMap((part) => {
          if (typeof part.text === "string") return [part.text]
          return []
        })
        .join("\n"),
    ]
  })
}

export function dialogTitled(title: string): RecordTest {
  return {
    description: `a dialog whose title includes ${JSON.stringify(title)}`,
    matches: (line) => {
      const dialog = recordOf(DialogRequestSchema, line)
      if (!dialog) return false
      return dialog.title.includes(title)
    },
  }
}

export function statusCleared(key: string): RecordTest {
  return {
    description: `the status ${JSON.stringify(key)} cleared`,
    matches: (line) => {
      const status = recordOf(StatusSchema, line)
      if (!status) return false
      return status.statusKey === key && typeof status.statusText !== "string"
    },
  }
}

export function nth(test: RecordTest, count: number): RecordTest {
  let seen = 0
  return {
    description: `occurrence ${count} of ${test.description}`,
    matches: (line) => {
      if (!test.matches(line)) return false
      seen += 1
      return seen >= count
    },
  }
}

export function endOf(turn: RpcTurn, toolName: string): ToolEnd {
  const last = turn.toolEnds.filter((end) => end.toolName === toolName).at(-1)
  if (!last)
    throw new Error(`${toolName} was not called; called: ${turn.toolStarts.map((start) => start.toolName).join(", ")}`)
  return last
}

export function lastEndOf(turn: RpcTurn, toolName: string): ToolEnd | null {
  const last = turn.toolEnds.filter((end) => end.toolName === toolName).at(-1)
  if (last) return last
  return null
}

export function toolStartCommands(turn: RpcTurn): string[][] {
  return turn.toolStarts.map((start) => {
    if (typeof start.args.command === "string") return [start.toolName, start.args.command]
    return [start.toolName]
  })
}

export function callsOf(turn: RpcTurn, toolName: string): number {
  return turn.toolStarts.filter((start) => start.toolName === toolName).length
}

export function notifiedWith(turn: RpcTurn, prefix: string): string[] {
  return turn.notifications.filter((notice) => notice.message.startsWith(prefix)).map((notice) => notice.message)
}

export function toolCallPrompt(toolName: string, argumentsJson: string): string {
  return `Call the ${toolName} tool exactly once with exactly these arguments: ${argumentsJson}. Do not call any other tool. After the call, reply with only DONE.`
}
