import Type, { type Static, type TSchema } from "typebox"
import { Value } from "typebox/value"

import { STATUS_LOADING } from "#src/pi"
import type { RpcTurn, ToolEnd } from "./e2e-records.ts"
import { endOf, statusCleared, toolCallPrompt } from "./e2e-turns.ts"
import type { E2eWorld } from "./e2e-world.ts"

const EditSchema = Type.Object({ oldText: Type.String(), newText: Type.String() })
type Edit = Static<typeof EditSchema>

function unfilled<Field extends TSchema>(field: Field) {
  return Type.Optional(Type.Union([field, Type.Null()]))
}

const SentArgumentsSchema = Type.Object({
  path: unfilled(Type.String()),
  content: unfilled(Type.String()),
  pattern: unfilled(Type.String()),
  glob: unfilled(Type.String()),
  command: unfilled(Type.String()),
  query: unfilled(Type.String()),
  vault: unfilled(Type.String()),
  edits: unfilled(Type.Array(EditSchema)),
  limit: unfilled(Type.Number()),
  offset: unfilled(Type.Number()),
  timeout: unfilled(Type.Number()),
})

const StartedCallSchema = Type.Object({ toolName: Type.String(), args: SentArgumentsSchema })

export interface CallArguments {
  path?: string | undefined
  content?: string | undefined
  pattern?: string | undefined
  glob?: string | undefined
  command?: string | undefined
  query?: string | undefined
  vault?: string | undefined
  edits?: Edit[] | undefined
  limit?: number | undefined
  offset?: number | undefined
  timeout?: number | undefined
}

export interface StartedCall {
  tool: string
  args: CallArguments
}

export interface CallOutcome {
  turn: RpcTurn
  end: ToolEnd
}

function textOf(value: string | null | undefined): string | undefined {
  if (typeof value === "string") return value
  return undefined
}

function numberOf(value: number | null | undefined): number | undefined {
  if (typeof value === "number") return value
  return undefined
}

function editsOf(value: Edit[] | null | undefined): Edit[] | undefined {
  if (Array.isArray(value)) return value
  return undefined
}

export function startedCalls(turn: RpcTurn): StartedCall[] {
  return turn.toolStarts.map((start) => {
    const { toolName, args } = Value.Parse(StartedCallSchema, start)
    return {
      tool: toolName,
      args: {
        path: textOf(args.path),
        content: textOf(args.content),
        pattern: textOf(args.pattern),
        glob: textOf(args.glob),
        command: textOf(args.command),
        query: textOf(args.query),
        vault: textOf(args.vault),
        edits: editsOf(args.edits),
        limit: numberOf(args.limit),
        offset: numberOf(args.offset),
        timeout: numberOf(args.timeout),
      },
    }
  })
}

async function startSession(world: E2eWorld): Promise<void> {
  if (world.memory === "none") {
    await world.pi.newSession()
    return
  }
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), 0)
  const from = world.pi.lines.length
  await world.pi.newSession()
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), from)
}

export async function callInNewSession(world: E2eWorld, call: StartedCall): Promise<CallOutcome> {
  await startSession(world)
  const turn = await world.pi.prompt(toolCallPrompt(call.tool, JSON.stringify(call.args)), [])
  return { turn, end: endOf(turn, call.tool) }
}
