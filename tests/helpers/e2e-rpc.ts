import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"

import { childEnv } from "./e2e-child-env.ts"
import { DialogDesk } from "./e2e-dialog-desk.ts"
import { LineBoard } from "./e2e-line-board.ts"
import { piCliPath } from "./e2e-paths.ts"
import {
  type DialogReply,
  problemWith,
  readLines,
  type UiAnswer,
  type UiStep,
  type UnexpectedDialog,
} from "./e2e-protocol.ts"
import {
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
  turnOf,
} from "./e2e-records.ts"
import { RpcCommands } from "./e2e-rpc-commands.ts"
import type { BegunCommand, IdentifiedCommand, OutgoingCommand, RpcStart } from "./e2e-rpc-types.ts"

const DIAGNOSTIC_LINES = 40
const DIAGNOSTIC_STDERR_CHARS = 4000

export class RpcPi extends RpcCommands {
  #child: ChildProcessWithoutNullStreams
  #desk = new DialogDesk((reply) => this.#write(reply))
  #begun: BegunCommand | null = null
  #board = new LineBoard()
  #nextId = 0
  #stderr = ""
  #exited = Promise.withResolvers<void>()

  constructor(start: RpcStart) {
    super()
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

  get unexpected(): UnexpectedDialog[] {
    return this.#desk.unexpected
  }

  get lines(): string[] {
    return this.#board.lines
  }

  get stderr(): string {
    return this.#stderr
  }

  get diagnostics(): string {
    return [
      "pending waiters:",
      ...this.#board.pending.map((waitingFor) => `- ${waitingFor.replaceAll(/\s+/g, " ")}`),
      `last ${DIAGNOSTIC_LINES} RPC lines:`,
      ...this.lines.slice(-DIAGNOSTIC_LINES),
      "stderr tail:",
      this.#stderr.slice(-DIAGNOSTIC_STDERR_CHARS),
    ].join("\n")
  }

  waitFor(test: RecordTest, from: number): Promise<string> {
    return this.#board.waitFor(test, from, `${test.description} from line ${from}`)
  }

  async prompt(message: string, steps: UiStep[]): Promise<RpcTurn> {
    const from = this.lines.length
    this.#desk.plan(steps)
    const disposition = dispositionOf(await this.send({ type: "prompt", message }))
    if (disposition !== "handled")
      await this.#board.waitFor(
        { description: "the turn to settle", matches: (line) => isRecord(SettledSchema, line) },
        from,
        `prompt ${JSON.stringify(message)}: the turn to settle, from line ${from}`,
      )
    return this.#endTurn(from, disposition)
  }

  async command(text: string, steps: UiStep[], done: RecordTest): Promise<RpcTurn> {
    const from = this.lines.length
    this.#desk.plan(steps)
    const disposition = dispositionOf(await this.send({ type: "prompt", message: text }))
    await this.#board.waitFor(done, from, `command ${JSON.stringify(text)}: ${done.description} from line ${from}`)
    return this.#endTurn(from, disposition)
  }

  async beginCommand(text: string, steps: UiStep[], open: RecordTest): Promise<void> {
    const from = this.lines.length
    this.#desk.plan(steps)
    const response = this.send({ type: "prompt", message: text })
    response.catch(() => undefined)
    this.#begun = { from, response }
    await this.#board.waitFor(open, from, `command ${JSON.stringify(text)}: ${open.description} from line ${from}`)
  }

  answerOpen(answer: UiAnswer): void {
    this.#desk.answerOpen(answer)
  }

  async endCommand(): Promise<RpcTurn> {
    const begun = this.#begun
    if (!begun) throw new Error("no command was begun")
    this.#begun = null
    return this.#endTurn(begun.from, dispositionOf(await begun.response))
  }

  async stop(): Promise<void> {
    this.#child.stdin.end()
    await this.#exited.promise
  }

  protected async send(command: OutgoingCommand): Promise<string> {
    this.#nextId += 1
    const id = `e2e-${this.#nextId}`
    const answered = this.#board.waitFor(isResponseTo(id), this.lines.length, `the response to ${command.type} ${id}`)
    this.#write({ ...command, id })
    const line = await answered
    const response = recordOf(RpcResponseSchema, line)
    if (!response?.success) throw new Error(`${command.type} failed: ${line}`)
    return line
  }

  #write(message: DialogReply | IdentifiedCommand): void {
    this.#child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  #receive(line: string): void {
    const problem = problemWith(line)
    if (problem) {
      this.#fail(new Error(`${problem}: ${line}`))
      return
    }
    this.#board.add(line)
    const dialog = recordOf(DialogRequestSchema, line)
    if (dialog) this.#desk.answer(dialog)
    this.#board.settle(line)
  }

  #endTurn(from: number, disposition: Disposition): RpcTurn {
    this.#desk.refuseUnusedSteps()
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
    this.#board.fail(error)
  }
}
