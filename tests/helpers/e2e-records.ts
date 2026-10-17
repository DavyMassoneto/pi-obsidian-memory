import Type, { type Static, type TSchema } from "typebox"
import { Value } from "typebox/value"

const DispositionSchema = Type.Union([Type.Literal("started"), Type.Literal("queued"), Type.Literal("handled")])
const NotifyLevelSchema = Type.Union([Type.Literal("info"), Type.Literal("warning"), Type.Literal("error")])
const CommandEntrySchema = Type.Object({
  name: Type.String(),
  source: Type.String(),
  sourceInfo: Type.Object({ path: Type.String() }),
})

export const RpcResponseSchema = Type.Object({
  type: Type.Literal("response"),
  id: Type.Optional(Type.String()),
  command: Type.String(),
  success: Type.Boolean(),
})
export const PromptResponseSchema = Type.Object({
  type: Type.Literal("response"),
  command: Type.Literal("prompt"),
  data: Type.Object({ disposition: DispositionSchema }),
})
export const CommandsResponseSchema = Type.Object({
  type: Type.Literal("response"),
  command: Type.Literal("get_commands"),
  data: Type.Object({ commands: Type.Array(CommandEntrySchema) }),
})
export const AssistantTextResponseSchema = Type.Object({
  type: Type.Literal("response"),
  command: Type.Literal("get_last_assistant_text"),
  data: Type.Object({ text: Type.Union([Type.String(), Type.Null()]) }),
})
export const StatsResponseSchema = Type.Object({
  type: Type.Literal("response"),
  command: Type.Literal("get_session_stats"),
  data: Type.Object({ cost: Type.Number(), tokens: Type.Object({ total: Type.Number() }) }),
})
export const DialogRequestSchema = Type.Object({
  type: Type.Literal("extension_ui_request"),
  id: Type.String(),
  method: Type.Union([Type.Literal("select"), Type.Literal("confirm"), Type.Literal("input"), Type.Literal("editor")]),
  title: Type.String(),
  options: Type.Optional(Type.Array(Type.String())),
})
export const NotifySchema = Type.Object({
  type: Type.Literal("extension_ui_request"),
  method: Type.Literal("notify"),
  message: Type.String(),
  notifyType: Type.Optional(NotifyLevelSchema),
})
export const StatusSchema = Type.Object({
  type: Type.Literal("extension_ui_request"),
  method: Type.Literal("setStatus"),
  statusKey: Type.String(),
  statusText: Type.Optional(Type.String()),
})
export const ToolStartSchema = Type.Object({
  type: Type.Literal("tool_execution_start"),
  toolCallId: Type.String(),
  toolName: Type.String(),
  args: Type.Object({ command: Type.Optional(Type.String()), path: Type.Optional(Type.String()) }),
})
export const ToolEndSchema = Type.Object({
  type: Type.Literal("tool_execution_end"),
  toolCallId: Type.String(),
  toolName: Type.String(),
  result: Type.Object({
    content: Type.Array(Type.Object({ type: Type.String(), text: Type.Optional(Type.String()) })),
  }),
  isError: Type.Boolean(),
})
export const SettledSchema = Type.Object({ type: Type.Literal("agent_settled"), aborted: Type.Boolean() })
export const ExtensionErrorSchema = Type.Object({
  type: Type.Literal("extension_error"),
  event: Type.String(),
  error: Type.String(),
})

export type Disposition = Static<typeof DispositionSchema>
export type CommandEntry = Static<typeof CommandEntrySchema>
export type DialogRequest = Static<typeof DialogRequestSchema>
export type Notify = Static<typeof NotifySchema>
export type StatusUpdate = Static<typeof StatusSchema>
export type ToolStart = Static<typeof ToolStartSchema>
export type ToolEnd = Static<typeof ToolEndSchema>
export type ExtensionError = Static<typeof ExtensionErrorSchema>
export type RecordTest = (line: string) => boolean

export interface RpcTurn {
  disposition: Disposition
  toolStarts: ToolStart[]
  toolEnds: ToolEnd[]
  notifications: Notify[]
  statuses: StatusUpdate[]
  extensionErrors: ExtensionError[]
  aborted: boolean
}

export function recordOf<Schema extends TSchema>(schema: Schema, line: string): Static<Schema> | null {
  const value = JSON.parse(line)
  if (Value.Check(schema, value)) return value
  return null
}

export function isRecord(schema: TSchema, line: string): boolean {
  if (recordOf(schema, line)) return true
  return false
}

export function recordsOf<Schema extends TSchema>(schema: Schema, lines: string[]): Static<Schema>[] {
  return lines.flatMap((line) => {
    const record = recordOf(schema, line)
    if (record) return [record]
    return []
  })
}

export function turnOf(lines: string[], disposition: Disposition): RpcTurn {
  return {
    disposition,
    toolStarts: recordsOf(ToolStartSchema, lines),
    toolEnds: recordsOf(ToolEndSchema, lines),
    notifications: recordsOf(NotifySchema, lines),
    statuses: recordsOf(StatusSchema, lines),
    extensionErrors: recordsOf(ExtensionErrorSchema, lines),
    aborted: recordsOf(SettledSchema, lines).some((settled) => settled.aborted),
  }
}

export function toolText(end: ToolEnd): string {
  return end.result.content
    .flatMap((part) => {
      if (typeof part.text === "string") return [part.text]
      return []
    })
    .join("\n")
}

export function notifySettles(texts: string[]): RecordTest {
  return (line) => {
    const notify = recordOf(NotifySchema, line)
    if (!notify) return false
    if (notify.notifyType === "error") return true
    return texts.some((text) => notify.message.startsWith(text))
  }
}

export function isResponseTo(id: string): RecordTest {
  return (line) => {
    const response = recordOf(RpcResponseSchema, line)
    if (!response) return false
    return response.id === id
  }
}

export function dispositionOf(line: string): Disposition {
  const response = recordOf(PromptResponseSchema, line)
  if (!response) throw new Error(`not a prompt response: ${line}`)
  return response.data.disposition
}
