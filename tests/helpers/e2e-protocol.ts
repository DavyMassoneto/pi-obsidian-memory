import type { ChildProcessWithoutNullStreams } from "node:child_process"
import { StringDecoder } from "node:string_decoder"

import Type, { type Static, type TSchema } from "typebox"

import {
  type DialogRequest,
  DialogRequestSchema,
  ExtensionErrorSchema,
  isRecord,
  NotifySchema,
  RpcResponseSchema,
  recordOf,
  SettledSchema,
  StatusSchema,
  ToolEndSchema,
  ToolStartSchema,
} from "./e2e-records.ts"

export interface UiValue {
  value: string
}
export interface UiOption {
  option: string
}
export interface UiConfirm {
  confirmed: boolean
}
export interface UiCancel {
  cancelled: true
}
export interface UiLeaveOpen {
  open: true
}
export type UiAnswer = UiValue | UiOption | UiConfirm | UiCancel | UiLeaveOpen
export interface UiStep {
  method: "select" | "confirm" | "input"
  title: string
  answer: UiAnswer
}
export interface UnexpectedDialog {
  method: string
  title: string
}
export interface DialogReply {
  type: "extension_ui_response"
  id: string
  value?: string
  confirmed?: boolean
  cancelled?: true
}
interface ReadRecord {
  type: string
  method?: string
  schema: TSchema
}
type LineHandler = (line: string) => void
type LineHeader = Static<typeof LineHeaderSchema>

const LineHeaderSchema = Type.Object({ type: Type.String(), method: Type.Optional(Type.String()) })
const READ_RECORDS: ReadRecord[] = [
  { type: "response", schema: RpcResponseSchema },
  { type: "extension_ui_request", method: "select", schema: DialogRequestSchema },
  { type: "extension_ui_request", method: "confirm", schema: DialogRequestSchema },
  { type: "extension_ui_request", method: "input", schema: DialogRequestSchema },
  { type: "extension_ui_request", method: "editor", schema: DialogRequestSchema },
  { type: "extension_ui_request", method: "notify", schema: NotifySchema },
  { type: "extension_ui_request", method: "setStatus", schema: StatusSchema },
  { type: "tool_execution_start", schema: ToolStartSchema },
  { type: "tool_execution_end", schema: ToolEndSchema },
  { type: "agent_settled", schema: SettledSchema },
  { type: "extension_error", schema: ExtensionErrorSchema },
]

export function replyFor(request: DialogRequest, step: UiStep | undefined): DialogReply | "open" | null {
  if (!step || step.method !== request.method || !request.title.includes(step.title)) return null
  if ("open" in step.answer) return "open"
  return replyTo(request, step.answer)
}

export function cancelReply(request: DialogRequest): DialogReply {
  return { type: "extension_ui_response", id: request.id, cancelled: true }
}

export function problemWith(line: string): string | null {
  try {
    return problemOfRecord(recordOf(LineHeaderSchema, line), line)
  } catch {
    return "pi sent a line that is not JSON"
  }
}

export function readLines(child: ChildProcessWithoutNullStreams, onLine: LineHandler): void {
  const decoder = new StringDecoder("utf8")
  let buffer = ""
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += decoder.write(chunk)
    for (let end = buffer.indexOf("\n"); end !== -1; end = buffer.indexOf("\n")) {
      const line = buffer.slice(0, end).replace(/\r$/, "")
      buffer = buffer.slice(end + 1)
      onLine(line)
    }
  })
}

function problemOfRecord(header: LineHeader | null, line: string): string | null {
  if (!header) return null
  const read = READ_RECORDS.find((record) => record.type === header.type && record.method === header.method)
  if (read && !isRecord(read.schema, line))
    return `pi sent a ${read.type} line that does not match what the harness reads`
  return null
}

export function replyTo(request: DialogRequest, answer: UiAnswer): DialogReply | null {
  const reply: DialogReply = { type: "extension_ui_response", id: request.id }
  if ("open" in answer) return null
  if ("value" in answer) return { ...reply, value: answer.value }
  if ("confirmed" in answer) return { ...reply, confirmed: answer.confirmed }
  if ("cancelled" in answer) return { ...reply, cancelled: true }
  const picked = request.options?.find((option) => option === answer.option || option.startsWith(`${answer.option} `))
  if (typeof picked !== "string") return null
  return { ...reply, value: picked }
}
