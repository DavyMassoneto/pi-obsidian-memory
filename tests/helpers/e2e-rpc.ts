import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"

import type { PiCredentialsEnv } from "./e2e-credentials.ts"
import { piCliPath } from "./e2e-paths.ts"
import { cancelReply, problemWith, readLines, replyFor, type UiStep, type UnexpectedDialog } from "./e2e-protocol.ts"
import {
  AssistantTextResponseSchema,
  type CommandEntry,
  CommandsResponseSchema,
  type DialogRequest,
  DialogRequestSchema,
  type Disposition,
  dispositionOf,
  isRecord,
  isResponseTo,
  type RecordTest,
  RpcResponseSchema,
  type RpcTurn,
  recordOf,
  SettledSchema,
  StatsResponseSchema,
  turnOf,
} from "./e2e-records.ts"
import { customTexts, MessagesResponseSchema } from "./e2e-turns.ts"

export interface RpcStart {
  cwd: string
  agentDir: string
  args: string[]
  credentials: PiCredentialsEnv
}
export interface SessionCost {
  cost: number
  totalTokens: number
}
interface OutgoingCommand {
  type: string
  message?: string
}
interface Waiter {
  test: RecordTest
  resolve(line: string): void
  reject(error: Error): void
}

export class RpcPi {
  readonly lines: string[] = []
  readonly unexpected: UnexpectedDialog[] = []
  #child: ChildProcessWithoutNullStreams
  #steps: UiStep[] = []
  #waiters: Waiter[] = []
  #nextId = 0
  #stderr = ""
  #failure: Error | null = null
  #exited = Promise.withResolvers<void>()

  constructor(start: RpcStart) {
    this.#child = spawn(process.execPath, [piCliPath(), "--mode", "rpc", ...start.args], {
      cwd: start.cwd,
      env: childEnv(start),
    })
    this.#child.stderr.setEncoding("utf8")
    this.#child.stderr.on("data", (chunk: string) => {
      this.#stderr += chunk
    })
    this.#child.on("error", (error) => this.#onBroken(error))
    this.#child.stdin.on("error", (error) => this.#fail(error))
    this.#child.once("close", (code) => this.#onExit(code))
    readLines(this.#child, (line) => this.#receive(line))
  }

  get stderr(): string {
    return this.#stderr
  }

  waitFor(test: RecordTest, from: number): Promise<string> {
    const found = this.lines.slice(from).find(test)
    if (typeof found === "string") return Promise.resolve(found)
    if (this.#failure) return Promise.reject(this.#failure)
    const waiting = Promise.withResolvers<string>()
    this.#waiters.push({ test, resolve: waiting.resolve, reject: waiting.reject })
    return waiting.promise
  }

  async prompt(message: string, steps: UiStep[]): Promise<RpcTurn> {
    const from = this.lines.length
    this.#steps.push(...steps)
    const disposition = dispositionOf(await this.#send({ type: "prompt", message }))
    if (disposition !== "handled") await this.waitFor((line) => isRecord(SettledSchema, line), from)
    return this.#endTurn(from, disposition)
  }

  async command(text: string, steps: UiStep[], done: RecordTest): Promise<RpcTurn> {
    const from = this.lines.length
    this.#steps.push(...steps)
    const disposition = dispositionOf(await this.#send({ type: "prompt", message: text }))
    await this.waitFor(done, from)
    return this.#endTurn(from, disposition)
  }

  async commands(): Promise<CommandEntry[]> {
    const response = recordOf(CommandsResponseSchema, await this.#send({ type: "get_commands" }))
    if (!response) throw new Error("get_commands returned another shape")
    return response.data.commands
  }

  async lastAssistantText(): Promise<string | null> {
    const response = recordOf(AssistantTextResponseSchema, await this.#send({ type: "get_last_assistant_text" }))
    if (!response) throw new Error("get_last_assistant_text returned another shape")
    return response.data.text
  }

  async customMessages(customType: string): Promise<string[]> {
    const response = recordOf(MessagesResponseSchema, await this.#send({ type: "get_messages" }))
    if (!response) throw new Error("get_messages returned another shape")
    return customTexts(response.data.messages, customType)
  }

  async cost(): Promise<SessionCost> {
    const response = recordOf(StatsResponseSchema, await this.#send({ type: "get_session_stats" }))
    if (!response) throw new Error("get_session_stats returned another shape")
    return { cost: response.data.cost, totalTokens: response.data.tokens.total }
  }

  async stop(): Promise<void> {
    this.#child.stdin.end()
    await this.#exited.promise
  }

  async #send(command: OutgoingCommand): Promise<string> {
    this.#nextId += 1
    const id = `e2e-${this.#nextId}`
    const answered = this.waitFor(isResponseTo(id), this.lines.length)
    this.#child.stdin.write(`${JSON.stringify({ ...command, id })}\n`)
    const line = await answered
    const response = recordOf(RpcResponseSchema, line)
    if (!response?.success) throw new Error(`${command.type} failed: ${line}`)
    return line
  }

  #receive(line: string): void {
    const problem = problemWith(line)
    if (problem) {
      this.#fail(new Error(`${problem}: ${line}`))
      return
    }
    this.lines.push(line)
    const dialog = recordOf(DialogRequestSchema, line)
    if (dialog) this.#answer(dialog)
    const matched = this.#waiters.filter((waiter) => waiter.test(line))
    this.#waiters = this.#waiters.filter((waiter) => !matched.includes(waiter))
    for (const waiter of matched) waiter.resolve(line)
  }

  #answer(request: DialogRequest): void {
    const reply = replyFor(request, this.#steps.shift())
    if (reply) {
      this.#child.stdin.write(`${JSON.stringify(reply)}\n`)
      return
    }
    this.unexpected.push({ method: request.method, title: request.title })
    this.#child.stdin.write(`${JSON.stringify(cancelReply(request))}\n`)
  }

  #endTurn(from: number, disposition: Disposition): RpcTurn {
    const unused = this.#steps.splice(0)
    if (unused.length > 0)
      throw new Error(`unused steps: ${unused.map((step) => `${step.method} "${step.title}"`).join(", ")}`)
    return turnOf(this.lines.slice(from), disposition)
  }

  #onBroken(error: Error): void {
    this.#fail(error)
    this.#exited.resolve()
  }

  #onExit(code: number | null): void {
    this.#fail(new Error(`pi exited with code ${code}: ${this.#stderr}`))
    this.#exited.resolve()
  }

  #fail(error: Error): void {
    this.#failure ??= error
    for (const waiter of this.#waiters) waiter.reject(this.#failure)
    this.#waiters = []
  }
}

function childEnv(start: RpcStart): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...start.credentials,
    PI_CODING_AGENT_DIR: start.agentDir,
    PI_SKIP_VERSION_CHECK: "1",
    PI_TELEMETRY: "0",
  }
  delete env.ANTHROPIC_AUTH_TOKEN
  delete env.ANTHROPIC_API_KEY
  return env
}
