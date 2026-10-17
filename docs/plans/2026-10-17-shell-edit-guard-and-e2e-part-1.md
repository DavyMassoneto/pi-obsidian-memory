# Shell-Edit Guard and Real E2E Tests — Implementation Plan (Part 1 of 3)

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Replace every simulated test with real end-to-end runs of pi (RPC mode, Haiku, Jev, temporary vaults), then add the Jev shell-edit guard.

**Architecture:** A test-only harness (`tests/helpers/e2e-*.ts`) starts the real pi CLI in RPC mode in a temporary agent folder. pi loads only this extension and skill, uses `anthropic/claude-haiku-5-5`, and gets credentials from the user's pi login through environment variables. The harness answers extension dialogs from a script and gathers tool results, notifications and status updates. Scenario tests live in `tests/e2e/*.e2e.test.ts` (vitest project `e2e`, `npm run test:e2e`) and check the disk.

**Tech Stack:** TypeScript, vitest 5, TypeBox 1.3 (`Value.Check` at the JSON boundary), pi 1.3.0 CLI (`dist/bundle/cli.js`), Node child processes.

**Parts:** Part 1 (this one) is the harness, the spikes and the map of simulated tests. Part 2 is scenarios 1–6 and 8, each followed by deleting the tests it replaces. Part 3 is the shell-edit guard (domain → services → usecase → pi, scenario 7 first), the cutoff measurement, docs/AGENTS/README/vitest, and final verification.

**Rules for every task:** files change only through edit/write. Deleting files and running npm/git/lint through the shell is fine. Only the orchestrator commits. Once Task A10 passes, `npm run test:e2e` runs before every commit.

---

## Verified pi 1.3.0 facts (paths under `node_modules/@earendil-works/`)

**(a) Login from a temporary agent folder**
- The agent folder comes only from `PI_CODING_AGENT_DIR` (`pi-coding-agent/dist/config.js:491-497`).
- The credentials file is always `<agentDir>/auth.json`:
  - `pi-coding-agent/dist/config.js:507-508`
  - `pi-coding-agent/dist/core/agent-session-services.js:55-58`
  - `pi-coding-agent/dist/core/auth-storage.js:31`
- The docs list no flag or env var for a separate credentials path (`pi-coding-agent/docs/environment-variables.md:81`, `pi-coding-agent/docs/configuration.md:9,17`). **Nothing supports pointing a temporary folder at the user's file.**
- **Closest safe option (chosen, needs user approval):**
  - pi's own `pi auth print-bearer-token` / `print-api-key` read the user's login (`pi-coding-agent/docs/cli.md:304-305`).
  - The harness hands the result to the child pi as `ANTHROPIC_OAUTH_TOKEN` and `TYPESAFE_API_KEY`:
    - `pi-coding-agent/docs/providers.md:50,67`
    - `pi-ai/dist/providers/anthropic.js:29`
    - `pi-ai/dist/providers/typesafe.js:10`
  - pi uses env credentials when no stored credential exists (`pi-coding-agent/docs/models.md:23`).
  - A token containing `sk-ant-oat` is sent as OAuth (`pi-ai/dist/api/anthropic-messages.js:783-784`).
  - Nothing is written to disk.
- **Rejected: hardlinking `auth.json` into the temp folder.** It would be the same file, but pi locks `<path>.lock` next to the path it was given (`realpath: false`, `pi-coding-agent/dist/core/auth-storage.js:67,91`). A token refresh would then not be coordinated with the user's running pi.
- **Unverified:** whether print-bearer-token returns an `sk-ant-oat` token for this login. Spike A1 checks.

**(b) Loading only our extension**
- Run from a fresh agent folder, so there is no `settings.json` with packages.
- `-e <path>` loads one extension (`pi-coding-agent/docs/cli.md:194`, `pi-coding-agent/docs/packages.md:40`).
- `-ne` disables discovered, configured and built-in extensions, but explicit `-e` still loads (`pi-coding-agent/docs/cli.md:196`).
- `-ns` plus `--skill <path>` (`pi-coding-agent/docs/cli.md:200-203`).
- `-np`, `--no-themes`, `-nc`, `--no-mcp`, `-na` (`pi-coding-agent/docs/cli.md:206,212,214,198,239`).
- The CLI is `pi-coding-agent/dist/bundle/cli.js` (`pi-coding-agent/package.json:9-10`).

**(c) RPC**
- **Start:** `--mode rpc --no-session` (`pi-coding-agent/docs/rpc.md:15`). Framing is JSONL split on LF only (`pi-coding-agent/docs/rpc.md:50-56`). Closing stdin shuts pi down (`pi-coding-agent/docs/rpc.md:93`).
- **Send a prompt:** `{"id","type":"prompt","message"}` (`pi-coding-agent/docs/rpc-commands.md:7-42`).
  - The response's `disposition` is `started`, `queued` or `handled`; slash commands of an extension are `handled` (`pi-coding-agent/docs/rpc-commands.md:31,40`).
- **End of a run:** wait for `agent_settled {aborted}`, not `agent_end` (`pi-coding-agent/docs/json.md:45-56`, `pi-coding-agent/docs/rpc.md:67-69`).
- **Tool results:** `tool_execution_end {toolCallId, toolName, result.content, isError}` (`pi-coding-agent/docs/json.md:107,114`).
  - A blocked call becomes an error result whose text is the block reason (`pi-agent-core/dist/agent-loop.js:507-516,640-645`).
  - A handler that throws is reported as `extension_error` (`pi-coding-agent/docs/json.md:190-193`).
- **Extension dialogs:** `select`, `confirm` and `input` arrive as `extension_ui_request` and block until answered (`pi-coding-agent/docs/rpc-extension-ui.md:7,31,48,65`).
  - Answers: `{"type":"extension_ui_response","id","value"}`, `{"confirmed"}` or `{"cancelled":true}` (`pi-coding-agent/docs/rpc-extension-ui.md:176-198`).
  - `notify` and `setStatus` need no answer (`pi-coding-agent/docs/rpc-extension-ui.md:97,113`).
  - `ctx.hasUI` is true in RPC mode (`pi-coding-agent/docs/rpc-extension-ui.md:25`).
- **Other commands used:** `get_commands` (`pi-coding-agent/docs/rpc-commands.md:788`), `get_last_assistant_text` (`pi-coding-agent/docs/rpc-commands.md:747`), `get_session_stats` (`pi-coding-agent/docs/rpc-commands.md:526-565`).

**(d) Model**
- `--provider anthropic --model claude-haiku-5-5` (`pi-coding-agent/docs/cli.md:63-66`).
- The id is in the catalog (`pi-ai/dist/providers/data/anthropic.json`, `"id":"claude-haiku-5-5"`).
- Jev is `typesafe` / `jev-latest` (`pi-coding-agent/docs/models.md:136`).

---

## Phase A — E2E harness and spikes

### Task A1: Spike — credentials from pi's own login

**Files:** Create `docs/plans/2026-10-17-e2e-spikes.md` (with the write tool).

**Step 1: Check that both logins are ready, without refreshing them**

Run from the worktree root:
```bash
env -u PI_CODING_AGENT_DIR node node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js auth check --provider anthropic --json --no-refresh
env -u PI_CODING_AGENT_DIR node node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js auth check --provider typesafe --json --no-refresh
```
Expected: both print JSON with status `ready` and exit 0 (`pi-coding-agent/docs/cli.md:302-311`).

**Step 2: Check what the print commands return, without showing the secret**
```bash
env -u PI_CODING_AGENT_DIR node -e "const {execFileSync}=require('child_process');const cli='node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js';const a=execFileSync('node',[cli,'auth','print-bearer-token','--provider','anthropic'],{encoding:'utf8'}).trim();const t=execFileSync('node',[cli,'auth','print-api-key','--provider','typesafe'],{encoding:'utf8'}).trim();console.log(a.length>0,a.includes('sk-ant-oat'),t.length>0)"
```
Expected: `true true true`. If the second value is `false`, stop and report it to the orchestrator: the env route would send the token as an API key.

**Step 3: Record the results**

Write `docs/plans/2026-10-17-e2e-spikes.md` with a section "A1 credentials". It holds the two status lines, the three booleans and the date. It never holds a token.

### Task A2: Spike — a junction to the shared model cache survives cleanup

**Step 1: Run the check**
```bash
node -e "const fs=require('fs'),os=require('os'),p=require('path');const t=fs.mkdtempSync(p.join(os.tmpdir(),'jt-'));fs.writeFileSync(p.join(t,'keep.txt'),'x');const r=fs.mkdtempSync(p.join(os.tmpdir(),'jr-'));fs.symlinkSync(t,p.join(r,'link'),'junction');fs.rmSync(r,{recursive:true,force:true});console.log(fs.existsSync(p.join(t,'keep.txt')));fs.rmSync(t,{recursive:true,force:true})"
```
Expected: `true`. If it prints `false`, remove `modelCache: "shared"` from the harness (Task A8) and report it.

**Step 2: Record the result**

Append a section "A2 junction cleanup" to the spikes document.

### Task A3: vitest project and npm script

**Files:** Modify `vitest.config.ts` and `package.json` (`scripts`).

**Step 1: Exclude E2E from `unit` and add the `e2e` project**

The project list becomes:
```ts
      {
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/**/*.smoke.test.ts", "tests/**/*.model.test.ts", "tests/e2e/**"],
        },
      },
      {
        test: {
          name: "pi",
          include: ["tests/**/*.smoke.test.ts"],
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: "model",
          include: ["tests/**/*.model.test.ts"],
          testTimeout: 600_000,
        },
      },
      {
        test: {
          name: "e2e",
          include: ["tests/e2e/**/*.e2e.test.ts"],
          testTimeout: 600_000,
          hookTimeout: 600_000,
        },
      },
```
600 000 ms is a starting value copied from the `model` project. Task A10 replaces it with a measured one.

**Step 2: Add the script**

In `package.json`, add `"test:e2e": "vitest run --project e2e",` after `"test:model"`.

**Step 3: Check that nothing else changed**

Run `npm test`. Expected: the same pass count as before the change.

### Task A4: The failing harness test

**Files:** Create `tests/e2e/harness.e2e.test.ts`.

**Step 1: Write the test**
```ts
import { readFile } from "node:fs/promises"

import { expect, test } from "vitest"

import { MEMORY_DOCTOR_COMMAND, MEMORY_EXPORT_COMMAND, MEMORY_INIT_COMMAND, MEMORY_SETUP_COMMAND } from "#src/pi"
import { DECISION_UNAVAILABLE } from "#src/usecases"
import { e2eWorld } from "#test-helpers"

test("pi starts with this extension only: the extension commands are the four memory commands", async () => {
  const world = await e2eWorld({ memory: "none", tools: [], modelCache: "fresh" })
  const commands = await world.pi.commands()
  const fromExtensions = commands.filter((command) => command.source === "extension").map((command) => command.name)
  expect(fromExtensions.sort()).toEqual(
    [MEMORY_DOCTOR_COMMAND, MEMORY_EXPORT_COMMAND, MEMORY_INIT_COMMAND, MEMORY_SETUP_COMMAND].sort(),
  )
})

test("Haiku answers through pi's own login", async () => {
  const world = await e2eWorld({ memory: "none", tools: [], modelCache: "fresh" })
  const turn = await world.pi.prompt("Reply with the single word READY and nothing else.", [])
  expect(turn.disposition).toBe("started")
  expect(turn.aborted).toBe(false)
  expect(await world.pi.lastAssistantText()).toContain("READY")
  console.info(`e2e one Haiku turn: ${JSON.stringify(await world.pi.cost())}`)
})

test("/memory-setup and /memory-init configure memory through their dialogs, and Jev answers a message", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared" })
  const config = await readFile(world.folders.configPath, "utf8")
  expect(config).toContain(JSON.stringify(world.folders.globalVault))
  expect(config).toContain(JSON.stringify(world.folders.projectVault))
  const turn = await world.pi.prompt("Which package manager does this project use?", [])
  expect(turn.notifications.filter((notice) => notice.message.startsWith(DECISION_UNAVAILABLE))).toEqual([])
  expect(turn.extensionErrors).toEqual([])
})
```

**Step 2: Run it and see it fail**

Run `npm run test:e2e`. Expected: FAIL with `e2eWorld` not exported by `#test-helpers` (or a typecheck error naming it).

### Task A5: Paths and the credentials reader

**Files:** Create `tests/helpers/e2e-paths.ts` and `tests/helpers/e2e-credentials.ts`.

**Step 1: `tests/helpers/e2e-paths.ts`**
```ts
import { join, resolve } from "node:path"

export const repoRoot = resolve(import.meta.dirname, "..", "..")

export const E2E_PROVIDER = "anthropic"

export const E2E_MODEL = "claude-haiku-5-5"

export const E2E_PROJECT_NAME = "e2e-project"

export function piCliPath(): string {
  return join(repoRoot, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js")
}

export function extensionPath(): string {
  return join(repoRoot, "src", "pi", "extension.ts")
}

export function skillsPath(): string {
  return join(repoRoot, "skills")
}
```

**Step 2: `tests/helpers/e2e-credentials.ts`**

Credentials are read once per pi start, so each start gets a token with pi's default remaining validity.
```ts
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { piCliPath } from "./e2e-paths.ts"

const run = promisify(execFile)

export interface PiCredentialsEnv {
  ANTHROPIC_OAUTH_TOKEN: string
  TYPESAFE_API_KEY: string
}

export async function piCredentialsEnv(): Promise<PiCredentialsEnv> {
  const anthropic = await printedByPi(["auth", "print-bearer-token", "--provider", "anthropic"])
  const typesafe = await printedByPi(["auth", "print-api-key", "--provider", "typesafe"])
  return { ANTHROPIC_OAUTH_TOKEN: anthropic, TYPESAFE_API_KEY: typesafe }
}

async function printedByPi(args: string[]): Promise<string> {
  const env = { ...process.env }
  delete env.PI_CODING_AGENT_DIR
  const { stdout } = await run("node", [piCliPath(), ...args], { env })
  const value = stdout.trim()
  if (value === "") throw new Error(`pi ${args.slice(0, 2).join(" ")} printed nothing`)
  return value
}
```

### Task A6: RPC record schemas

**Files:** Create `tests/helpers/e2e-records.ts`.

**Step 1: Write the file**
```ts
import Type, { type Static, type TSchema } from "typebox"
import { Value } from "typebox/value"

const DispositionSchema = Type.Union([Type.Literal("started"), Type.Literal("queued"), Type.Literal("handled")])
const NotifyLevelSchema = Type.Union([Type.Literal("info"), Type.Literal("warning"), Type.Literal("error")])
const CommandEntrySchema = Type.Object({ name: Type.String(), source: Type.String() })

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
  result: Type.Object({ content: Type.Array(Type.Object({ type: Type.String(), text: Type.Optional(Type.String()) })) }),
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
  return Value.Check(schema, JSON.parse(line))
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
```

### Task A7: The RPC client

**Files:** Create `tests/helpers/e2e-rpc.ts`.

**Step 1: Write the file**
```ts
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import { StringDecoder } from "node:string_decoder"

import type { PiCredentialsEnv } from "./e2e-credentials.ts"
import { piCliPath } from "./e2e-paths.ts"
import {
  AssistantTextResponseSchema,
  type CommandEntry,
  CommandsResponseSchema,
  type DialogRequest,
  DialogRequestSchema,
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

export interface UiValue { value: string }
export interface UiOption { option: string }
export interface UiConfirm { confirmed: boolean }
export interface UiCancel { cancelled: true }
export type UiAnswer = UiValue | UiOption | UiConfirm | UiCancel
export interface UiStep { method: "select" | "confirm" | "input"; title: string; answer: UiAnswer }
export interface UnexpectedDialog { method: string; title: string }
export interface RpcStart { cwd: string; agentDir: string; args: string[]; credentials: PiCredentialsEnv }
export interface SessionCost { cost: number; totalTokens: number }
interface OutgoingCommand { type: string; message?: string }
interface DialogReply { type: "extension_ui_response"; id: string; value?: string; confirmed?: boolean; cancelled?: true }
interface Waiter { test: RecordTest; resolve(line: string): void; reject(error: Error): void }
type LineHandler = (line: string) => void

export class RpcPi {
  readonly lines: string[] = []
  readonly unexpected: UnexpectedDialog[] = []
  #child: ChildProcessWithoutNullStreams
  #steps: UiStep[] = []
  #waiters: Waiter[] = []
  #nextId = 0
  #stderr = ""
  #exitError: Error | null = null
  #exited = Promise.withResolvers<void>()

  constructor(start: RpcStart) {
    this.#child = spawn("node", [piCliPath(), "--mode", "rpc", ...start.args], { cwd: start.cwd, env: childEnv(start) })
    this.#child.stderr.on("data", (chunk) => {
      this.#stderr += String(chunk)
    })
    this.#child.once("exit", (code) => this.#onExit(code))
    readLines(this.#child, (line) => this.#receive(line))
  }

  get stderr(): string {
    return this.#stderr
  }

  waitFor(test: RecordTest, from: number): Promise<string> {
    const found = this.lines.slice(from).find(test)
    if (typeof found === "string") return Promise.resolve(found)
    if (this.#exitError) return Promise.reject(this.#exitError)
    const waiting = Promise.withResolvers<string>()
    this.#waiters.push({ test, resolve: waiting.resolve, reject: waiting.reject })
    return waiting.promise
  }

  async prompt(message: string, steps: UiStep[]): Promise<RpcTurn> {
    const from = this.lines.length
    this.#steps.push(...steps)
    const disposition = dispositionOf(await this.#send({ type: "prompt", message }))
    if (disposition !== "handled") await this.waitFor((line) => isRecord(SettledSchema, line), from)
    return turnOf(this.lines.slice(from), disposition)
  }

  async command(text: string, steps: UiStep[], done: RecordTest): Promise<RpcTurn> {
    const from = this.lines.length
    this.#steps.push(...steps)
    const disposition = dispositionOf(await this.#send({ type: "prompt", message: text }))
    await this.waitFor(done, from)
    return turnOf(this.lines.slice(from), disposition)
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
    this.lines.push(line)
    const dialog = recordOf(DialogRequestSchema, line)
    if (dialog) this.#answer(dialog)
    const waiting = this.#waiters
    this.#waiters = waiting.filter((waiter) => !waiter.test(line))
    for (const waiter of waiting) if (waiter.test(line)) waiter.resolve(line)
  }

  #answer(request: DialogRequest): void {
    const step = this.#steps.shift()
    let reply: DialogReply | null = null
    if (step && step.method === request.method && request.title.includes(step.title)) reply = replyTo(request, step.answer)
    if (!reply) {
      this.unexpected.push({ method: request.method, title: request.title })
      reply = { type: "extension_ui_response", id: request.id, cancelled: true }
    }
    this.#child.stdin.write(`${JSON.stringify(reply)}\n`)
  }

  #onExit(code: number | null): void {
    this.#exitError = new Error(`pi exited with code ${code}: ${this.#stderr}`)
    for (const waiter of this.#waiters) waiter.reject(this.#exitError)
    this.#waiters = []
    this.#exited.resolve()
  }
}

function replyTo(request: DialogRequest, answer: UiAnswer): DialogReply | null {
  const reply: DialogReply = { type: "extension_ui_response", id: request.id }
  if ("value" in answer) return { ...reply, value: answer.value }
  if ("confirmed" in answer) return { ...reply, confirmed: answer.confirmed }
  if ("cancelled" in answer) return { ...reply, cancelled: true }
  const picked = request.options?.find((option) => option === answer.option || option.startsWith(`${answer.option} `))
  if (typeof picked !== "string") return null
  return { ...reply, value: picked }
}

function childEnv(start: RpcStart): NodeJS.ProcessEnv {
  const env = {
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

function readLines(child: ChildProcessWithoutNullStreams, onLine: LineHandler): void {
  const decoder = new StringDecoder("utf8")
  let buffer = ""
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += decoder.write(chunk)
    for (let end = buffer.indexOf("\n"); end !== -1; end = buffer.indexOf("\n")) {
      onLine(buffer.slice(0, end).replace(/\r$/, ""))
      buffer = buffer.slice(end + 1)
    }
  })
}
```
`ANTHROPIC_AUTH_TOKEN` is checked before `ANTHROPIC_OAUTH_TOKEN` (`pi-ai/dist/providers/anthropic.js:21-34`), so both inherited Anthropic keys are removed from the child's environment.

### Task A8: The world (temporary folders, setup through dialogs, cleanup)

**Files:** Create `tests/helpers/e2e-world.ts`. Modify `tests/helpers/index.ts`: add six export lines after `./diagnose-memory.ts`, in alphabetical order: `./e2e-credentials.ts`, `./e2e-paths.ts`, `./e2e-protocol.ts` (split out of `e2e-rpc.ts` in A7), `./e2e-records.ts`, `./e2e-rpc.ts`, `./e2e-world.ts`.

**Step 1: Write the file**
```ts
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { onTestFinished } from "vitest"

import {
  INIT_CANCELLED,
  INIT_DONE,
  INIT_NAME_TITLE,
  INIT_VAULT_TITLE,
  MEMORY_INIT_COMMAND,
  MEMORY_SETUP_COMMAND,
  memoryConfigPath,
  memoryModelCachePath,
  SETUP_AGENT_MODEL_TITLE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_CAPTURE_MODEL_TITLE,
  SETUP_DONE,
  SETUP_MODE_TITLE,
  SETUP_VAULT_TITLE,
} from "#src/pi"
import { piCredentialsEnv } from "./e2e-credentials.ts"
import { E2E_MODEL, E2E_PROJECT_NAME, E2E_PROVIDER, extensionPath, skillsPath } from "./e2e-paths.ts"
import { notifySettles, type RpcTurn } from "./e2e-records.ts"
import { RpcPi } from "./e2e-rpc.ts"
import { benchmarkCacheFolder } from "./embedding-benchmark.ts"

export interface WorldOptions {
  memory: "none" | "configured"
  tools: string[]
  modelCache: "fresh" | "shared"
}

export interface WorldFolders {
  root: string
  agentDir: string
  cwd: string
  globalVault: string
  projectVault: string
  configPath: string
}

export class E2eWorld {
  readonly folders: WorldFolders
  #options: WorldOptions
  #pi: RpcPi

  constructor(folders: WorldFolders, options: WorldOptions, pi: RpcPi) {
    this.folders = folders
    this.#options = options
    this.#pi = pi
  }

  get pi(): RpcPi {
    return this.#pi
  }

  async restart(): Promise<void> {
    await this.#pi.stop()
    this.#pi = await startPi(this.folders, this.#options)
  }

  stop(): Promise<void> {
    return this.#pi.stop()
  }
}

export async function e2eWorld(options: WorldOptions): Promise<E2eWorld> {
  const folders = await worldFolders()
  if (options.modelCache === "shared") await shareModelCache(folders.agentDir)
  const world = new E2eWorld(folders, options, await startPi(folders, options))
  onTestFinished(async () => {
    await world.stop()
    await rm(folders.root, { recursive: true, force: true })
  })
  if (options.memory === "configured") await configureMemory(world)
  return world
}

async function worldFolders(): Promise<WorldFolders> {
  const root = await mkdtemp(join(tmpdir(), "pi-memory-e2e-"))
  const folders = {
    root,
    agentDir: join(root, "agent"),
    cwd: join(root, "project"),
    globalVault: join(root, "global-vault"),
    projectVault: join(root, "project-vault"),
  }
  for (const folder of [folders.agentDir, folders.cwd, folders.globalVault, folders.projectVault]) await mkdir(folder)
  return { ...folders, configPath: memoryConfigPath(folders.agentDir) }
}

async function shareModelCache(agentDir: string): Promise<void> {
  const link = memoryModelCachePath(agentDir)
  await mkdir(dirname(link), { recursive: true })
  await mkdir(benchmarkCacheFolder(), { recursive: true })
  await symlink(benchmarkCacheFolder(), link, "junction")
}

async function startPi(folders: WorldFolders, options: WorldOptions): Promise<RpcPi> {
  const credentials = await piCredentialsEnv()
  return new RpcPi({ cwd: folders.cwd, agentDir: folders.agentDir, args: piArgs(options.tools), credentials })
}

function piArgs(tools: string[]): string[] {
  const args = ["--no-session", "--provider", E2E_PROVIDER, "--model", E2E_MODEL, "-ne", "-e", extensionPath()]
  args.push("-ns", "--skill", skillsPath(), "-np", "--no-themes", "-nc", "--no-mcp", "-na")
  if (tools.length > 0) args.push("--tools", tools.map((tool) => `+${tool}`).join(","))
  return args
}

async function configureMemory(world: E2eWorld): Promise<void> {
  const model = `${E2E_PROVIDER}/${E2E_MODEL}`
  const { globalVault, projectVault } = world.folders
  const setup = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "select", title: SETUP_CAPTURE_MODEL_TITLE, answer: { option: model } },
      { method: "select", title: SETUP_AGENT_MODEL_TITLE, answer: { option: model } },
      { method: "select", title: SETUP_MODE_TITLE, answer: { value: SETUP_ATTACH_OPTION } },
      { method: "input", title: SETUP_VAULT_TITLE, answer: { value: globalVault } },
    ],
    notifySettles([SETUP_DONE, SETUP_CANCELLED]),
  )
  refuseFailures("setup", world, setup)
  const init = await world.pi.command(
    `/${MEMORY_INIT_COMMAND}`,
    [
      { method: "input", title: INIT_NAME_TITLE, answer: { value: E2E_PROJECT_NAME } },
      { method: "input", title: INIT_VAULT_TITLE, answer: { value: projectVault } },
    ],
    notifySettles([INIT_DONE, INIT_CANCELLED]),
  )
  refuseFailures("init", world, init)
  await world.restart()
}

function refuseFailures(step: string, world: E2eWorld, turn: RpcTurn): void {
  const errors = turn.notifications.filter((notice) => notice.notifyType === "error").map((notice) => notice.message)
  if (world.pi.unexpected.length === 0 && errors.length === 0) return
  throw new Error(`${step}: unexpected dialogs ${JSON.stringify(world.pi.unexpected)}; errors ${JSON.stringify(errors)}`)
}
```

**Step 2: Lint and typecheck**

Run `npm run lint` and `npm run typecheck`. Expected: clean. If a lint rule rejects a construct, fix it in place and keep the behavior.

### Task A9: Harness green, and the spike on the setup/init dialog order

**Step 1: Run the E2E project**

Run `npm run test:e2e`. Expected: 3 passed.

**Step 2: If the third test throws "setup: unexpected dialogs …"**

The thrown text lists the real dialog order. This happens if `/memory-setup` on a missing config asks a repair `confirm` before choosing models; the code path is `confirmRepair` in `src/pi/memory-setup/memory-setup.ts`, and whether it fires on a missing config is not verified. Fix the step list in `configureMemory` to match the recorded order. Never cancel through a dialog. Rerun until 3 pass.

**Step 3: Record what happened**

Append "A9 setup/init dialog order" to the spikes document, with the recorded order.

### Task A10: Measure the run and set the timeouts

**Step 1: Run with verbose output**

Run `npx vitest run --project e2e --reporter=verbose`. Note:
- each test's duration;
- the `e2e one Haiku turn: {cost,totalTokens}` line;
- the total time.

**Step 2: Record and adjust**

Append "A10 duration and cost" to the spikes document.
- If the longest single-pi run exceeds 5 minutes, add `"--min-expiry", "<measured>m"` to the print-bearer-token arguments in `e2e-credentials.ts`. pi's default OAuth validity is five minutes (`pi-coding-agent/dist/core/model-runtime.d.ts`, `minOAuthValidityMs` comment).
- If any test came within 2× of 600 000 ms, raise `testTimeout` and `hookTimeout` in `vitest.config.ts` to twice the measured maximum.

**Step 3: Full checks**

Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run test:e2e`. Expected: all pass.

**Step 4: Commit (orchestrator)**
```bash
git add vitest.config.ts package.json tests/e2e/harness.e2e.test.ts tests/helpers/e2e-paths.ts tests/helpers/e2e-credentials.ts tests/helpers/e2e-records.ts tests/helpers/e2e-rpc.ts tests/helpers/e2e-world.ts tests/helpers/index.ts docs/plans/2026-10-17-e2e-spikes.md
git commit -m "test(e2e): real pi over RPC with Haiku and Jev through pi's login; harness and spikes"
```

---

## Harness API for Parts 2–3 (all from `#test-helpers`)

**World**
- `e2eWorld({ memory, tools, modelCache })` returns an `E2eWorld`.
  - `memory: "configured"` runs `/memory-setup` (attach the global vault) and `/memory-init` (project vault, name `E2E_PROJECT_NAME`), then restarts pi.
  - `tools` adds built-ins as `+name` (for example `["powershell"]`).
  - `modelCache: "shared"` junctions to `benchmarkCacheFolder()`.
- `world.folders`: `{root, agentDir, cwd, globalVault, projectVault, configPath}`.
- `world.restart()` starts a new session on the same folders. Cleanup is automatic: pi is stopped, then `root` is removed.

**Driving pi**
- `world.pi.prompt(message, steps)` resolves after `agent_settled` and returns an `RpcTurn`: `{disposition, toolStarts, toolEnds, notifications, statuses, extensionErrors, aborted}`.
- `world.pi.command("/name", steps, done)` is for extension commands. Use `done = notifySettles([...prefixes])`, which also settles on any error notify.
- `steps: UiStep[]` is a list of `{method, title (substring), answer}`. An answer is `{value}`, `{option}` (an exact option, or one starting with "option "), `{confirmed}` or `{cancelled:true}`.
- A dialog that doesn't match the next step is cancelled and logged in `world.pi.unexpected`. Tests assert it is `[]`.

**Background work**
- `world.pi.waitFor(test, from)` waits for capture and other background events, for example a `setStatus` with key `obsidian-memory-capturing` and no text. Take `from = world.pi.lines.length` first.

**Reading results**
- `toolText(end)` returns the text of a tool result; a blocked call's reason is in it.
- `world.pi.lastAssistantText()`, `world.pi.commands()`, `world.pi.cost()`.
- Test files go in `tests/e2e/<area>.e2e.test.ts`.

---

## Simulated test files and their replacing scenario

The list comes from grepping `tests/**/*.test.ts` for `fakePiContext`, `vi.fn/mock/spyOn`, `completionPort`, fake classifier/embedder, `setSystemTime`, `useFakeTimers` and the Laya/embedding HTTP fakes, plus helpers whose bodies use them, followed until nothing new appeared. That gives 92 files. Files marked † reach a fake only through a fixture that has a fake-free branch; Part 2 confirms per test before deleting.

| Scenario | Files (what they simulate) |
|---|---|
| A + 6 (harness, vault guard) | `pi/extension.smoke.test.ts` (fake ctx), `pi/vault-guard/vault-guard.test.ts` (fake ctx) |
| 1 memory tools | `pi/extension.test.ts`, `pi/registrar.test.ts`, `pi/memory-add/memory-add.test.ts`, `pi/memory-search/memory-search.test.ts`, `pi/memory-get/memory-get.test.ts`, `pi/memory-update/memory-update.test.ts`, `pi/memory-archive/memory-archive.test.ts`, `pi/memory-succeed/memory-succeed.test.ts`, `pi/memory-session/keeper.test.ts` (fake pi); `usecases/add-memory/add-memory.test.ts`, `usecases/update-memory/update-memory.test.ts`, `usecases/archive-memory/archive-memory.test.ts`, `usecases/succeed-memory/succeed-memory.test.ts`, `services/clock/clock.test.ts`, `services/id/id.test.ts` (clock); `usecases/memory-change/change.test.ts` (vi.fn) |
| 2 setup/init | `pi/memory-setup/{memory-setup,choose-models,disclosure-choices}.test.ts`, `pi/memory-settings/{edits,models,projects,providers,save,screen}.test.ts`, `pi/memory-init/memory-init.test.ts`, `pi/session-start/session-start.test.ts` (fake pi) |
| 3 doctor/export | `pi/memory-doctor/{memory-doctor,decision-report}.test.ts` (fake pi, Jev and Laya fakes), `pi/memory-export/memory-export.test.ts` (fake pi, clock), `usecases/diagnose-memory/{diagnose-memory,decision}.test.ts` (fake model port), `usecases/complete-blank-memory/complete-blank-memory.test.ts` (clock), `services/llm/check-chat-models.test.ts` (fake model port) |
| 4 Don't forget / per message | `pi/memory-block/{block,status}.test.ts`, `pi/context/status.test.ts`, `pi/relevant-memory/{runtime,runtime-jev,runtime-session,status}.test.ts` (fake pi); `usecases/relevant-memory/{agent,decision,retrieve-cutoffs,retrieve-limits,retrieve-memory,session-memory}.test.ts`, `refresh.test.ts`†, `track-dont-forget.test.ts`† (LLM and decision fakes); `usecases/load-dont-forget/load-dont-forget.test.ts` (timers); `services/llm/retrieve.test.ts` (LLM); `services/decision-model/{decide,interruption,jev,score-candidates}.test.ts` (Jev fake, vi.mock, timers) |
| 5 capture | `pi/capture/{completion,handlers,runtime,status}.test.ts` (fake pi); `usecases/capture-memory/{capture-memory.run,capture-memory,refusal,rounds,semantic,walk}.test.ts` (LLM, clock, embedder); `services/llm/{capture,complete,lifetime}.test.ts` (LLM, timers) |
| 8 semantic | `pi/semantic/runtime.test.ts` (fake local access); `usecases/semantic/{prepare,rank,refresh-vectors}.test.ts`, `usecases/search-memory/semantic-search.test.ts` (fake embedder); `services/embeddings/{inference,local,local.load,operation}.test.ts` (vi.mock, model double, timers) |
| **No scenario: user decision** | Laya HTTP fake: `services/decision-model/{laya,laya-batch,laya-response,laya-response-tolerance,preflight,prompts}.test.ts`; live Laya with `vi.spyOn`: `services/decision-model/thresholds.model.test.ts`; remote embeddings and model-download fakes: `services/embeddings/{openai,google,http,asset-download,model-asset,asset-inspection}.test.ts` |

Scenario 7 (shell-edit guard) replaces nothing that exists today. The 16 + 11 + 7 + 21 + 13 + 2 + 9 + 13 rows above total 92 files.

## Risks and unverified items
- **Env credentials instead of the shared file (a):** needs the user's approval. A1 checks that the token is OAuth.
- **Junction cleanup:** A2 checks that `rm` on the world root leaves the shared model cache intact.
- **Setup dialog order:** A9 records the real order.
- **Model list at startup:** `getAvailable()` might be empty before pi's async availability check finishes. `/memory-setup` would then show an error; `refuseFailures` throws with its text.
- **Token lifetime:** A10 measures run length against pi's 5-minute default validity.
- **Shutdown time:** closing stdin runs session-end capture, so cleanup can take minutes. `hookTimeout` covers it.
- **Layout:** `tests/e2e/` does not mirror `src/`. Part 3 writes this exception into AGENTS.md.

## Noticed, out of scope
- `tests/helpers/index.ts` exports `relevance-fixtures.ts` and `relevance-notes.ts` twice each.
