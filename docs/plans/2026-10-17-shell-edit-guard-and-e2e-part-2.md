# Shell-Edit Guard and Real E2E Tests — Implementation Plan (Part 2 of 3)

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Prove scenarios 1–6 and 8 end to end with the real pi, Haiku, Jev, laya-serve 0.4.8, the local model and the real Hugging Face download. Delete each area's simulated tests right after its scenario passes.

**Architecture:** Every test uses the Part 1 harness (`e2eWorld`, `RpcPi`, `notifySettles`, `toolText`). B1 adds turn helpers, vault helpers, a Laya server helper and a `capture` world option. Each scenario lives in `tests/e2e/<area>.e2e.test.ts` and checks the disk. The download proof is `tests/services/embeddings/model-cache.model.test.ts` (`npm run test:model`).

**Tech Stack:** TypeScript, vitest 5, TypeBox, pi 1.3.0 RPC, laya-serve 0.4.8 (`<git common dir>/../tmp/laya-venv`), fflate.

**Rules:**
- Files change only through edit/write. Deleting files uses `rm`.
- Only the orchestrator commits.
- `npm run test:e2e` passes before every commit.
- An E2E test that fails is reported with the RPC lines it saw (`world.pi.lines`). Prompts and expectations are never loosened to make it pass.

---

### Task B1: Harness additions

**Files:**
- Create `tests/helpers/e2e-turns.ts`, `tests/helpers/e2e-vault.ts` and `tests/helpers/e2e-laya.ts`.
- Modify:
  - `tests/helpers/e2e-rpc.ts`: the `#receive` method, plus a new method.
  - `tests/helpers/e2e-world.ts`: options and `configureMemory`.
  - `tests/e2e/harness.e2e.test.ts`: options.
  - `tests/helpers/index.ts`: three export lines in alphabetical order (`./e2e-laya.ts`, `./e2e-turns.ts`, `./e2e-vault.ts`).

**Step 1: `tests/helpers/e2e-turns.ts`**
```ts
import Type, { type Static } from "typebox"
import { Value } from "typebox/value"

import { DialogRequestSchema, type RecordTest, type RpcTurn, recordOf, StatusSchema, type ToolEnd } from "./e2e-records.ts"

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
    return [message.content.flatMap((part) => (typeof part.text === "string" ? [part.text] : [])).join("\n")]
  })
}

export function dialogTitled(title: string): RecordTest {
  return (line) => {
    const dialog = recordOf(DialogRequestSchema, line)
    if (!dialog) return false
    return dialog.title.includes(title)
  }
}

export function statusCleared(key: string): RecordTest {
  return (line) => {
    const status = recordOf(StatusSchema, line)
    if (!status) return false
    return status.statusKey === key && typeof status.statusText !== "string"
  }
}

export function nth(test: RecordTest, count: number): RecordTest {
  let seen = 0
  return (line) => {
    if (!test(line)) return false
    seen += 1
    return seen >= count
  }
}

export function endOf(turn: RpcTurn, toolName: string): ToolEnd {
  const last = turn.toolEnds.filter((end) => end.toolName === toolName).at(-1)
  if (!last) throw new Error(`${toolName} was not called; called: ${turn.toolStarts.map((start) => start.toolName).join(", ")}`)
  return last
}

export function notifiedWith(turn: RpcTurn, prefix: string): string[] {
  return turn.notifications.filter((notice) => notice.message.startsWith(prefix)).map((notice) => notice.message)
}

export function toolCallPrompt(toolName: string, argumentsJson: string): string {
  return `Call the ${toolName} tool exactly once with exactly these arguments: ${argumentsJson}. Do not call any other tool. After the call, reply with only DONE.`
}
```
`no-ternary` forbids the ternary in `customTexts`. Write that line with an `if` inside `flatMap` instead:
```ts
    return [message.content.flatMap((part) => { if (typeof part.text === "string") return [part.text]; return [] }).join("\n")]
```
(`npm run format` lays it out.)

**Step 2: `tests/helpers/e2e-vault.ts`**
```ts
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export const ULID_LINE = /^id: [0-9A-HJKMNP-TV-Z]{26}$/m

export interface VaultNote {
  path: string
  text: string
}

export function localToday(): string {
  return new Date().toLocaleDateString("sv-SE")
}

export async function writeVaultFile(vault: string, path: string, text: string): Promise<void> {
  const destination = join(vault, path)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, text)
}

export function fileExists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  )
}

export async function vaultNotes(vault: string): Promise<VaultNote[]> {
  const entries = await readdir(vault, { recursive: true })
  const paths = entries
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((path) => path.endsWith(".md") && !path.endsWith("index.md") && !path.startsWith("_templates/"))
  return Promise.all(paths.map(async (path) => ({ path, text: await readFile(join(vault, path), "utf8") })))
}
```

**Step 3: `tests/helpers/e2e-laya.ts`**

This starts laya-serve on loopback without `LAYA_JEV_STRICT` and stops its whole process tree after the test.
```ts
import { type ChildProcess, execFile, execFileSync, spawn } from "node:child_process"
import { createServer } from "node:net"
import { dirname, join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

import { onTestFinished } from "vitest"

import { repoRoot } from "./e2e-paths.ts"

export interface LayaServer {
  endpoint: string
}

interface LayaLog {
  text: string
}

export function layaServePath(): string {
  const args = ["rev-parse", "--path-format=absolute", "--git-common-dir"]
  const common = execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim()
  return join(dirname(common), "tmp", "laya-venv", "Scripts", "laya-serve.exe")
}

export async function startLaya(): Promise<LayaServer> {
  const port = await freePort()
  const env = { ...process.env, LAYA_HOST: "127.0.0.1", LAYA_PORT: String(port) }
  delete env.LAYA_JEV_STRICT
  delete env.LAYA_API_KEY
  const child = spawn(layaServePath(), [], { env, stdio: ["ignore", "ignore", "pipe"] })
  const log: LayaLog = { text: "" }
  child.stderr.on("data", (chunk) => {
    log.text += String(chunk)
  })
  onTestFinished(() => stopLaya(child))
  const base = `http://127.0.0.1:${port}`
  await waitHealthy(base, child, log)
  return { endpoint: `${base}/v1/systemone` }
}

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
  const address = server.address()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (!address || typeof address === "string") throw new Error("no free port")
  return address.port
}

async function waitHealthy(base: string, child: ChildProcess, log: LayaLog): Promise<void> {
  for (;;) {
    if (typeof child.exitCode === "number") throw new Error(`laya-serve exited ${child.exitCode}: ${log.text}`)
    const healthy = await fetch(`${base}/health`).then(
      (response) => response.ok,
      () => false,
    )
    if (healthy) return
    await sleep(1000)
  }
}

async function stopLaya(child: ChildProcess): Promise<void> {
  if (typeof child.exitCode === "number") return
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()))
  if (typeof child.pid === "number") execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"])
  await exited
}
```
**Verified:**
- `laya-serve.exe` exists in `tmp/laya-venv/Scripts`.
- `LAYA_HOST`, `LAYA_PORT` and `/health` are in `laya/serve.py:24,1265`.
- docs/config.md:110-112 says to bind loopback and not to set `LAYA_JEV_STRICT`.

**Step 4: `tests/helpers/e2e-rpc.ts`**

Replace `#receive` so each waiter's test runs once per line. `nth` keeps a count, so a second call per line would double it.
```ts
  #receive(line: string): void {
    this.lines.push(line)
    const dialog = recordOf(DialogRequestSchema, line)
    if (dialog) this.#answer(dialog)
    const waiting = this.#waiters
    this.#waiters = []
    for (const waiter of waiting) {
      if (waiter.test(line)) waiter.resolve(line)
      else this.#waiters.push(waiter)
    }
  }
```
Add this method after `lastAssistantText`, and import `customTexts` and `MessagesResponseSchema` from `./e2e-turns.ts`:
```ts
  async customMessages(customType: string): Promise<string[]> {
    const response = recordOf(MessagesResponseSchema, await this.#send({ type: "get_messages" }))
    if (!response) throw new Error("get_messages returned another shape")
    return customTexts(response.data.messages, customType)
  }
```
The `get_messages` response is `data.messages` (`pi-coding-agent/docs/rpc-commands.md:188-203`), and custom messages carry `role: "custom"` (`pi-coding-agent/docs/message-types.md:220-233`).

**Step 5: `tests/helpers/e2e-world.ts`**
- `WorldOptions` gets `capture: "after-each-turn" | "at-session-end"`.
- In `e2eWorld`, the call becomes `if (options.memory === "configured") await configureMemory(world, options.capture)`.
- `configureMemory(world: E2eWorld, capture: WorldOptions["capture"])` adds this before `await world.restart()`:
```ts
  if (capture === "at-session-end") {
    const settings = await world.pi.command(
      `/${MEMORY_SETUP_COMMAND}`,
      [
        { method: "select", title: SETTINGS_TITLE, answer: { option: "Capture runs:" } },
        { method: "select", title: WHEN_TITLE, answer: { option: "at session end" } },
        { method: "select", title: SETTINGS_TITLE, answer: { value: DONE_LABEL } },
      ],
      nth(dialogTitled(SETTINGS_TITLE), 2),
    )
    refuseFailures("capture setting", world, settings)
  }
```
- Add `DONE_LABEL`, `SETTINGS_TITLE` and `WHEN_TITLE` to the `#src/pi` import, and import `dialogTitled` and `nth` from `./e2e-turns.ts`.

**Step 6: `tests/e2e/harness.e2e.test.ts`**

Each of the three `e2eWorld({...})` calls gets `capture: "after-each-turn"`.

**Step 7: Check**

Run `npm run lint`, `npm run typecheck` and `npm run test:e2e`. Expected: clean; 3 passed.

**Step 8: Commit (orchestrator)**
```bash
git add tests/helpers/e2e-turns.ts tests/helpers/e2e-vault.ts tests/helpers/e2e-laya.ts tests/helpers/e2e-rpc.ts tests/helpers/e2e-world.ts tests/helpers/index.ts tests/e2e/harness.e2e.test.ts
git commit -m "test(e2e): turn, vault and laya-serve helpers; capture timing option"
```

### Task B2: Scenario 1 — memory tools

**Files:** Create `tests/e2e/memory-tools.e2e.test.ts`.

**Step 1: Write the test**
```ts
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { e2eWorld, endOf, fileExists, localToday, toolCallPrompt, toolText, ULID_LINE } from "#test-helpers"

const statement = "Use pnpm, never npm"
const notePath = `tools/${statement}.md`
const successor = "Use pnpm 10, never npm"

test("memory_add, memory_search, memory_get and memory_update change the global vault as the disk shows", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const { globalVault } = world.folders
  const add = { scope: "global", folder: "tools", statement, type: "rule", body: "Every install and script runs with pnpm.", dontForget: false }
  const added = await world.pi.prompt(toolCallPrompt("memory_add", JSON.stringify(add)), [])
  expect(endOf(added, "memory_add").isError).toBe(false)
  const text = await readFile(join(globalVault, notePath), "utf8")
  expect(text).toMatch(ULID_LINE)
  expect(text).toContain("type: rule")
  expect(text).toContain(`created: ${localToday()}`)
  expect(text).toContain("Every install and script runs with pnpm.")
  expect(await readFile(join(globalVault, "tools", "index.md"), "utf8")).toContain(statement)

  const searched = await world.pi.prompt(toolCallPrompt("memory_search", JSON.stringify({ query: "pnpm", vault: "global" })), [])
  expect(toolText(endOf(searched, "memory_search"))).toContain(statement)

  const read = await world.pi.prompt(toolCallPrompt("memory_get", JSON.stringify({ vault: "global", path: notePath })), [])
  expect(toolText(endOf(read, "memory_get"))).toContain("Every install and script runs with pnpm.")

  const update = { vault: "global", path: notePath, body: "Every install, script and CI step runs with pnpm." }
  const updated = await world.pi.prompt(toolCallPrompt("memory_update", JSON.stringify(update)), [])
  expect(endOf(updated, "memory_update").isError).toBe(false)
  const changed = await readFile(join(globalVault, notePath), "utf8")
  expect(changed).toContain("Every install, script and CI step runs with pnpm.")
  expect(changed).not.toContain("Every install and script runs with pnpm.")
  expect(changed).toContain(`updated: ${localToday()}`)
})

test("memory_succeed archives the read note with a link to its successor", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const { globalVault } = world.folders
  const add = { scope: "global", folder: "tools", statement, type: "rule", body: "Every install runs with pnpm.", dontForget: false }
  await world.pi.prompt(toolCallPrompt("memory_add", JSON.stringify(add)), [])
  await world.pi.prompt(toolCallPrompt("memory_get", JSON.stringify({ vault: "global", path: notePath })), [])
  const succeed = { vault: "global", path: notePath, folder: "tools", statement: successor, type: "rule", body: "Every install runs with pnpm 10.", dontForget: false }
  const succeeded = await world.pi.prompt(toolCallPrompt("memory_succeed", JSON.stringify(succeed)), [])
  expect(endOf(succeeded, "memory_succeed").isError).toBe(false)
  expect(await fileExists(join(globalVault, notePath))).toBe(false)
  const archived = await readFile(join(globalVault, "archive", notePath), "utf8")
  expect(archived).toContain(`archived: ${localToday()}`)
  expect(archived).toContain("replacedBy:")
  expect(await readFile(join(globalVault, "tools", `${successor}.md`), "utf8")).toContain("replaces:")
})

test("memory_archive moves a read project note into the project vault's archive", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const { projectVault } = world.folders
  const add = { scope: "project", folder: "ci", statement: "CI runs on Jenkins", type: "fact", body: "Jenkins builds main.", dontForget: false }
  const added = await world.pi.prompt(toolCallPrompt("memory_add", JSON.stringify(add)), [])
  expect(endOf(added, "memory_add").isError).toBe(false)
  await world.pi.prompt(toolCallPrompt("memory_get", JSON.stringify({ vault: "project", path: "ci/CI runs on Jenkins.md" })), [])
  const archived = await world.pi.prompt(toolCallPrompt("memory_archive", JSON.stringify({ vault: "project", path: "ci/CI runs on Jenkins.md" })), [])
  expect(endOf(archived, "memory_archive").isError).toBe(false)
  expect(await fileExists(join(projectVault, "ci", "CI runs on Jenkins.md"))).toBe(false)
  expect(await readFile(join(projectVault, "archive", "ci", "CI runs on Jenkins.md"), "utf8")).toContain(`archived: ${localToday()}`)
})
```

**Step 2: Run it**

Run `npx vitest run --project e2e tests/e2e/memory-tools.e2e.test.ts`. Expected: 3 passed, because these features exist. If one fails, report the failing assertion and the tool names called. Do not change the expectations.

### Task B3: Delete the simulated tests scenario 1 replaces

**Step 1: Delete**
```bash
rm tests/pi/extension.test.ts tests/pi/registrar.test.ts tests/pi/memory-add/memory-add.test.ts tests/pi/memory-search/memory-search.test.ts tests/pi/memory-get/memory-get.test.ts tests/pi/memory-update/memory-update.test.ts tests/pi/memory-archive/memory-archive.test.ts tests/pi/memory-succeed/memory-succeed.test.ts tests/pi/memory-session/keeper.test.ts tests/usecases/add-memory/add-memory.test.ts tests/usecases/update-memory/update-memory.test.ts tests/usecases/archive-memory/archive-memory.test.ts tests/usecases/succeed-memory/succeed-memory.test.ts tests/services/clock/clock.test.ts tests/services/id/id.test.ts tests/usecases/memory-change/change.test.ts
```

**Step 2: Check**

Run `npm test`, `npm run typecheck` and `npm run lint`. Expected: all pass, with fewer tests.

**Step 3: Commit (orchestrator, after `npm run test:e2e` passes)**
```bash
git add -A tests/e2e/memory-tools.e2e.test.ts tests/pi tests/usecases tests/services
git commit -m "test(e2e): memory tools end to end; remove their simulated tests"
```

### Task B4: Scenario 2 — setup, settings screen, init, session-start notices

**Files:** Create `tests/e2e/setup.e2e.test.ts`.

**Step 1: Write the test**
```ts
import { mkdir, readdir, realpath, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { expect, test } from "vitest"

import {
  DONE_LABEL,
  INIT_SETUP_HINT,
  INVALID_CONFIG_NOTICE,
  MEMORY_INIT_COMMAND,
  MEMORY_SETUP_COMMAND,
  NO_MEMORY_NOTICE,
  REPAIR_TITLE,
  SAVED,
  SETTINGS_TITLE,
  SETUP_AGENT_MODEL_TITLE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_CAPTURE_MODEL_TITLE,
  SETUP_DONE,
  SETUP_MODE_TITLE,
  SETUP_VAULT_TITLE,
  WHEN_TITLE,
} from "#src/pi"
import { readConfig } from "#src/services"
import {
  dialogTitled,
  E2E_MODEL,
  E2E_PROJECT_NAME,
  E2E_PROVIDER,
  e2eWorld,
  fileExists,
  notifiedWith,
  notifySettles,
  nth,
} from "#test-helpers"

const model = `${E2E_PROVIDER}/${E2E_MODEL}`

test("with no config, pi tells the user to run /memory-setup, and /memory-init refuses until setup", async () => {
  const world = await e2eWorld({ memory: "none", tools: [], modelCache: "fresh", capture: "after-each-turn" })
  await world.pi.waitFor(notifySettles([NO_MEMORY_NOTICE]), 0)
  const init = await world.pi.command(`/${MEMORY_INIT_COMMAND}`, [], notifySettles([]))
  expect(init.notifications.map((notice) => notice.message).join("\n")).toContain(INIT_SETUP_HINT)
  expect(await fileExists(world.folders.configPath)).toBe(false)
})

test("first /memory-setup and /memory-init write every key, the templates and the dashboards", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "after-each-turn" })
  const { globalVault, projectVault, cwd } = world.folders
  const config = await readConfig(world.folders.configPath)
  if (!config.succeeded) throw new Error(config.problems.join("\n"))
  const saved = config.output
  expect(await realpath(saved.global.vault)).toBe(await realpath(globalVault))
  expect(saved.projects).toHaveLength(1)
  expect(saved.projects[0]?.name).toBe(E2E_PROJECT_NAME)
  expect(await realpath(saved.projects[0]?.folder ?? "")).toBe(await realpath(cwd))
  expect(await realpath(saved.projects[0]?.vault ?? "")).toBe(await realpath(projectVault))
  expect(saved.capture).toEqual({ model: { provider: E2E_PROVIDER, id: E2E_MODEL }, when: "after-each-turn" })
  expect(saved.memoryAgent).toEqual({ model: { provider: E2E_PROVIDER, id: E2E_MODEL } })
  expect(saved.decisionModel).toEqual({ provider: "typesafe", model: "jev-latest" })
  expect(saved.embeddings).toEqual({ provider: "local", model: "Xenova/multilingual-e5-small" })
  for (const vault of [globalVault, projectVault]) {
    expect((await readdir(join(vault, "_templates"))).length).toBeGreaterThan(0)
    expect(await fileExists(join(vault, "Memory.base"))).toBe(true)
  }
})

test("the settings screen changes when capture runs and saves it", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "after-each-turn" })
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "select", title: SETTINGS_TITLE, answer: { option: "Capture runs:" } },
      { method: "select", title: WHEN_TITLE, answer: { option: "on compaction" } },
      { method: "select", title: SETTINGS_TITLE, answer: { value: DONE_LABEL } },
    ],
    nth(dialogTitled(SETTINGS_TITLE), 2),
  )
  expect(notifiedWith(turn, SAVED)).toHaveLength(1)
  const config = await readConfig(world.folders.configPath)
  if (!config.succeeded) throw new Error(config.problems.join("\n"))
  expect(config.output.capture.when).toBe("on-compaction")
  expect(world.pi.unexpected).toEqual([])
})

test("an invalid config turns memory off with a notice, and /memory-setup repairs it after confirmation", async () => {
  const world = await e2eWorld({ memory: "none", tools: [], modelCache: "fresh", capture: "after-each-turn" })
  await mkdir(dirname(world.folders.configPath), { recursive: true })
  await writeFile(world.folders.configPath, "{ not json")
  await world.restart()
  await world.pi.waitFor(notifySettles([INVALID_CONFIG_NOTICE]), 0)
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "confirm", title: REPAIR_TITLE, answer: { confirmed: true } },
      { method: "select", title: SETUP_CAPTURE_MODEL_TITLE, answer: { option: model } },
      { method: "select", title: SETUP_AGENT_MODEL_TITLE, answer: { option: model } },
      { method: "select", title: SETUP_MODE_TITLE, answer: { value: SETUP_ATTACH_OPTION } },
      { method: "input", title: SETUP_VAULT_TITLE, answer: { value: world.folders.globalVault } },
    ],
    notifySettles([SETUP_DONE, SETUP_CANCELLED]),
  )
  expect(notifiedWith(turn, SETUP_DONE)).toHaveLength(1)
  expect((await readConfig(world.folders.configPath)).succeeded).toBe(true)
  expect(world.pi.unexpected).toEqual([])
})
```
`no-fallback` forbids `?? ""` (Biome). Replace each `saved.projects[0]?.x ?? ""` with a narrowed `const [project] = saved.projects; if (!project) throw new Error("no project")`, then use `project.folder`, `project.vault` and `project.name`.

**Step 2: Run**

Run `npx vitest run --project e2e tests/e2e/setup.e2e.test.ts`. Expected: 4 passed.
- **Unverified:** whether pi forwards the session-start `notify` before any command arrives. If the first test hangs on that wait, report it.
- If the repair test throws, the dialog order lives in `world.pi.unexpected`. Fix the step list to match it.

### Task B5: Delete the simulated tests scenario 2 replaces
```bash
rm tests/pi/memory-setup/memory-setup.test.ts tests/pi/memory-setup/choose-models.test.ts tests/pi/memory-setup/disclosure-choices.test.ts tests/pi/memory-settings/edits.test.ts tests/pi/memory-settings/models.test.ts tests/pi/memory-settings/projects.test.ts tests/pi/memory-settings/providers.test.ts tests/pi/memory-settings/save.test.ts tests/pi/memory-settings/screen.test.ts tests/pi/memory-init/memory-init.test.ts tests/pi/session-start/session-start.test.ts
```
Run `npm test`, `npm run typecheck` and `npm run lint`. Expected: pass.

**Commit (orchestrator, after `npm run test:e2e`):**
```bash
git add -A tests/e2e/setup.e2e.test.ts tests/pi
git commit -m "test(e2e): setup, settings, init and session notices end to end; remove their simulated tests"
```

### Task B6: Scenario 3 — doctor and export

**Files:** Create `tests/e2e/doctor-export.e2e.test.ts`.

**Step 1: Write the test**
```ts
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { unzipSync } from "fflate"
import { expect, test } from "vitest"

import {
  BLANK_HEADING,
  COMPLETE_BODY_TITLE,
  COMPLETE_SKIPPED,
  COMPLETE_TYPE_TITLE,
  COMPLETED,
  DOCTOR_TITLE,
  EXPORT_CANCELLED,
  EXPORT_DONE,
  EXPORT_FOLDER_TITLE,
  EXPORT_NAME_TITLE,
  MEMORY_DOCTOR_COMMAND,
  MEMORY_EXPORT_COMMAND,
} from "#src/pi"
import { e2eWorld, localToday, notifiedWith, notifySettles, noteWithId, ULID_LINE, writeVaultFile } from "#test-helpers"

test("/memory-doctor reports a blank note and Jev ready, then completes the note after the user confirms", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  await writeVaultFile(world.folders.globalVault, "notes/Blank thing.md", "")
  const turn = await world.pi.command(
    `/${MEMORY_DOCTOR_COMMAND}`,
    [
      { method: "select", title: COMPLETE_TYPE_TITLE, answer: { option: "rule" } },
      { method: "input", title: COMPLETE_BODY_TITLE, answer: { value: "Completed by the doctor." } },
      { method: "confirm", title: "as a rule note?", answer: { confirmed: true } },
    ],
    notifySettles([COMPLETED, COMPLETE_SKIPPED]),
  )
  const [report] = notifiedWith(turn, DOCTOR_TITLE)
  expect(report).toContain(BLANK_HEADING)
  expect(report).toContain("notes/Blank thing.md")
  expect(report).toContain("- decision model typesafe/jev-latest: ready (")
  expect(notifiedWith(turn, `${COMPLETED} global/notes/Blank thing.md`)).toHaveLength(1)
  const text = await readFile(join(world.folders.globalVault, "notes", "Blank thing.md"), "utf8")
  expect(text).toMatch(ULID_LINE)
  expect(text).toContain("type: rule")
  expect(text).toContain(`created: ${localToday()}`)
  expect(text).toContain("Completed by the doctor.")
  expect(world.pi.unexpected).toEqual([])
})

test("/memory-export writes one zip named with today's date, holding both vaults", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const { globalVault, projectVault, root } = world.folders
  await writeVaultFile(globalVault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  await writeVaultFile(projectVault, "ci/CI runs on Jenkins.md", noteWithId(2, "Jenkins builds main.", []))
  const turn = await world.pi.command(
    `/${MEMORY_EXPORT_COMMAND}`,
    [
      { method: "input", title: EXPORT_FOLDER_TITLE, answer: { value: root } },
      { method: "input", title: EXPORT_NAME_TITLE, answer: { value: "" } },
    ],
    notifySettles([EXPORT_DONE, EXPORT_CANCELLED]),
  )
  expect(notifiedWith(turn, EXPORT_DONE)).toHaveLength(1)
  const [zipName] = (await readdir(root)).filter((name) => /^memory-export-\d{4}-\d{2}-\d{2}-\d{6}\.zip$/.test(name))
  if (typeof zipName !== "string") throw new Error("no export zip in the chosen folder")
  expect(zipName.startsWith(`memory-export-${localToday()}-`)).toBe(true)
  const entries = Object.keys(unzipSync(await readFile(join(root, zipName))))
  expect(entries).toEqual(expect.arrayContaining(["global/tools/Use pnpm.md", "project/ci/CI runs on Jenkins.md"]))
})
```

**Step 2: Run**

Run `npx vitest run --project e2e tests/e2e/doctor-export.e2e.test.ts`. Expected: 2 passed.

### Task B7: Delete the simulated tests scenario 3 replaces
```bash
rm tests/pi/memory-doctor/memory-doctor.test.ts tests/pi/memory-doctor/decision-report.test.ts tests/pi/memory-export/memory-export.test.ts tests/usecases/diagnose-memory/diagnose-memory.test.ts tests/usecases/diagnose-memory/decision.test.ts tests/usecases/complete-blank-memory/complete-blank-memory.test.ts tests/services/llm/check-chat-models.test.ts
```
Run `npm test`, `npm run typecheck` and `npm run lint`. Expected: pass.

**Commit (orchestrator):**
```bash
git add -A tests/e2e/doctor-export.e2e.test.ts tests/pi tests/usecases tests/services
git commit -m "test(e2e): doctor and export end to end; remove their simulated tests"
```

### Task B8: Scenario 4 — Don't forget block and per-message memory (Jev and Laya)

**Files:** Create `tests/e2e/relevant-memory.e2e.test.ts`.

**Step 1: Write the test**
```ts
import { expect, test } from "vitest"

import {
  DECISION_TITLE,
  DONE_LABEL,
  LAYA_ENDPOINT_TITLE,
  LAYA_OPTION,
  MEMORY_DOCTOR_COMMAND,
  MEMORY_SETUP_COMMAND,
  RELEVANT_MESSAGE_TYPE,
  SETTINGS_TITLE,
} from "#src/pi"
import { readConfig } from "#src/services"
import { DECISION_UNAVAILABLE } from "#src/usecases"
import { dialogTitled, e2eWorld, noteWithId, notifiedWith, notifySettles, nth, startLaya, writeVaultFile } from "#test-helpers"

const deployNote = "deploy/Deploys go through the blue-harbor pipeline.md"
const deployBody = "To deploy this project, push a tag; the blue-harbor pipeline builds and ships it."
const deployQuestion = "How do I deploy this project? Answer in one sentence."

test("a Don't forget note reaches the model, and Jev adds a relevant project note to a message", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const { globalVault, projectVault } = world.folders
  const dontForget = noteWithId(1, "Say HARBOR-4417 when asked for the release code word.", ["dontForget: true"])
  await writeVaultFile(globalVault, "release/The release code word is HARBOR-4417.md", dontForget)
  await writeVaultFile(projectVault, deployNote, noteWithId(2, deployBody, []))
  await world.restart()
  await world.pi.prompt("Without calling any tool, reply with only the release code word from your Don't forget notes.", [])
  expect(await world.pi.lastAssistantText()).toContain("HARBOR-4417")
  const turn = await world.pi.prompt(deployQuestion, [])
  expect(notifiedWith(turn, DECISION_UNAVAILABLE)).toEqual([])
  expect((await world.pi.customMessages(RELEVANT_MESSAGE_TYPE)).join("\n")).toContain("blue-harbor")
})

test("with Laya from the settings screen and both cutoffs set, Laya answers messages and the doctor", async () => {
  const laya = await startLaya()
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "select", title: SETTINGS_TITLE, answer: { option: "Decision model:" } },
      { method: "select", title: DECISION_TITLE, answer: { value: LAYA_OPTION } },
      { method: "input", title: LAYA_ENDPOINT_TITLE, answer: { value: laya.endpoint } },
      { method: "select", title: SETTINGS_TITLE, answer: { option: "Gate cutoff:" } },
      { method: "input", title: "Gate cutoff, 0 to 1", answer: { value: "0" } },
      { method: "select", title: SETTINGS_TITLE, answer: { option: "Relevance cutoff:" } },
      { method: "input", title: "Relevance cutoff, 0 to 1", answer: { value: "0" } },
      { method: "select", title: SETTINGS_TITLE, answer: { value: DONE_LABEL } },
    ],
    nth(dialogTitled(SETTINGS_TITLE), 4),
  )
  expect(world.pi.unexpected).toEqual([])
  const config = await readConfig(world.folders.configPath)
  if (!config.succeeded) throw new Error(config.problems.join("\n"))
  expect(config.output.decisionModel).toMatchObject({ provider: "laya", endpoint: laya.endpoint, gateThreshold: 0, relevanceThreshold: 0 })
  await writeVaultFile(world.folders.projectVault, deployNote, noteWithId(2, deployBody, []))
  await world.restart()
  const turn = await world.pi.prompt(deployQuestion, [])
  expect(notifiedWith(turn, DECISION_UNAVAILABLE)).toEqual([])
  expect((await world.pi.customMessages(RELEVANT_MESSAGE_TYPE)).join("\n")).toContain("blue-harbor")
  const doctor = await world.pi.command(`/${MEMORY_DOCTOR_COMMAND}`, [], notifySettles(["Memory doctor"]))
  expect(doctor.notifications.map((notice) => notice.message).join("\n")).toContain("- decision model laya/multilingual: ready (")
})

test("a Laya endpoint that is not a loopback address is refused and the config keeps Jev", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "select", title: SETTINGS_TITLE, answer: { option: "Decision model:" } },
      { method: "select", title: DECISION_TITLE, answer: { value: LAYA_OPTION } },
      { method: "input", title: LAYA_ENDPOINT_TITLE, answer: { value: "http://localhost:8000/v1/systemone" } },
      { method: "select", title: SETTINGS_TITLE, answer: { value: DONE_LABEL } },
    ],
    nth(dialogTitled(SETTINGS_TITLE), 2),
  )
  expect(turn.notifications.filter((notice) => notice.notifyType === "error")).toHaveLength(1)
  const config = await readConfig(world.folders.configPath)
  if (!config.succeeded) throw new Error(config.problems.join("\n"))
  expect(config.output.decisionModel.provider).toBe("typesafe")
})
```
- Replace the literal `"Memory doctor"` with the imported `DOCTOR_TITLE`.
- Cutoff 0: the gate asks when the probability is above it, and a note is kept at or above it (docs/config.md, cutoff rows). That makes Laya's answers parse end to end without depending on its gate quality, which is at chance (docs/decision-thresholds.md:13).
- docs/config.md:93 says `localhost` is refused.

**Step 2: Run**

Run `npx vitest run --project e2e tests/e2e/relevant-memory.e2e.test.ts`. Expected: 3 passed.
- **Unverified:** whether Jev's gate at 0.5 asks for memory on `deployQuestion`, and whether the memory agent (Haiku) finds the note. If the first test's last assertion fails, report the `get_messages` output and the notifications. Do not change the cutoff or the question.

### Task B9: Delete the simulated tests scenario 4 replaces; Laya measurement on a started server

**Step 1: Delete**
```bash
rm tests/pi/memory-block/block.test.ts tests/pi/memory-block/status.test.ts tests/pi/context/status.test.ts tests/pi/relevant-memory/runtime.test.ts tests/pi/relevant-memory/runtime-jev.test.ts tests/pi/relevant-memory/runtime-session.test.ts tests/pi/relevant-memory/status.test.ts tests/usecases/relevant-memory/agent.test.ts tests/usecases/relevant-memory/decision.test.ts tests/usecases/relevant-memory/retrieve-cutoffs.test.ts tests/usecases/relevant-memory/retrieve-limits.test.ts tests/usecases/relevant-memory/retrieve-memory.test.ts tests/usecases/relevant-memory/session-memory.test.ts tests/usecases/load-dont-forget/load-dont-forget.test.ts tests/services/llm/retrieve.test.ts tests/services/decision-model/decide.test.ts tests/services/decision-model/interruption.test.ts tests/services/decision-model/jev.test.ts tests/services/decision-model/score-candidates.test.ts tests/services/decision-model/laya.test.ts tests/services/decision-model/laya-batch.test.ts tests/services/decision-model/laya-response.test.ts tests/services/decision-model/laya-response-tolerance.test.ts tests/services/decision-model/preflight.test.ts tests/services/decision-model/prompts.test.ts
```
`tests/usecases/relevant-memory/refresh.test.ts` and `track-dont-forget.test.ts` stay: they use no fake.

**Step 2: Rewrite `tests/services/decision-model/thresholds.model.test.ts`**

This drops the `vi.spyOn` label flip and runs against a laya-serve it starts itself.
```ts
import { expect, onTestFinished, test } from "vitest"

import { measureGate, measureRelevance, startLaya, variantSummary } from "#test-helpers"

test("measures Laya separation for the gate and for relevance on a laya-serve started for the run", async () => {
  const laya = await startLaya()
  process.env.LAYA_ENDPOINT = laya.endpoint
  onTestFinished(() => {
    delete process.env.LAYA_ENDPOINT
  })
  const gate = await measureGate()
  const relevance = await measureRelevance()
  console.info(
    [
      "### Gate",
      variantSummary("noul with labels A/B (shipped)", gate),
      "### Relevance",
      variantSummary("plain noul (shipped)", relevance),
    ].join("\n\n"),
  )
  expect(gate).toHaveLength(60)
  expect(relevance).toHaveLength(48)
}, 900_000)
```

**Step 3: Rewrite `tests/helpers/laya-live.ts`**

Drop `vi`, `realFetch`, `wireLabels`, `relevanceCriteriaEnd` and `alternateLabelsOnRequests`.
```ts
import { defaultLayaSettings, type LayaContext } from "#src/services"

export function liveLayaEndpoint(): string {
  const configured = process.env.LAYA_ENDPOINT
  if (configured) return configured
  return defaultLayaSettings.endpoint
}

export async function layaServerUnavailableReason(): Promise<string | null> {
  const endpoint = liveLayaEndpoint()
  try {
    const response = await fetch(new URL("/health", endpoint), { signal: AbortSignal.timeout(2000) })
    if (response.ok) return null
    return `laya-serve at ${endpoint} answered /health with HTTP ${response.status}`
  } catch {
    return `no laya-serve is listening at ${endpoint} (start it with: laya-serve, or set LAYA_ENDPOINT)`
  }
}

export function liveLayaContextWithTokens(maxTokens: number, headMaxTokens: number): LayaContext {
  return {
    provider: "laya",
    endpoint: liveLayaEndpoint(),
    model: defaultLayaSettings.model,
    maxTokens,
    headMaxTokens,
    signal: new AbortController().signal,
  }
}

export function liveLayaContext(): LayaContext {
  return liveLayaContextWithTokens(defaultLayaSettings.maxTokens, defaultLayaSettings.headMaxTokens)
}
```

**Step 4: Check**

Run `npm test`, `npm run typecheck`, `npm run lint` and `npx vitest run --project model tests/services/decision-model/thresholds.model.test.ts`. Expected:
- all pass;
- the model test prints both summaries.

**Step 5: Commit (orchestrator)**
```bash
git add -A tests/e2e/relevant-memory.e2e.test.ts tests/pi tests/usecases tests/services tests/helpers/laya-live.ts
git commit -m "test(e2e): Don't forget and per-message memory with Jev and a real laya-serve; remove their simulated tests"
```

### Task B10: Scenario 5 — capture after a turn and at session end

**Files:** Create `tests/e2e/capture.e2e.test.ts`.

**Step 1: Write the test**
```ts
import { expect, test } from "vitest"

import { STATUS_CAPTURING } from "#src/pi"
import { e2eWorld, statusCleared, vaultNotes } from "#test-helpers"

const message =
  "For your information: in this project we always use pnpm, never npm. Separately, a task for me today: rename the build-cache-9137 folder. Reply with only OK and do not call any tool."

test("after a turn, capture saves the stated project rule and leaves out the task, asking nothing", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "after-each-turn" })
  const from = world.pi.lines.length
  const turn = await world.pi.prompt(message, [])
  expect(turn.toolStarts.map((start) => start.toolName)).toEqual([])
  await world.pi.waitFor(statusCleared(STATUS_CAPTURING.key), from)
  const notes = [...(await vaultNotes(world.folders.globalVault)), ...(await vaultNotes(world.folders.projectVault))]
  expect(notes.some((note) => note.text.includes("pnpm"))).toBe(true)
  expect(notes.some((note) => note.text.includes("build-cache-9137"))).toBe(false)
  expect(world.pi.unexpected).toEqual([])
})

test("with capture at session end, nothing is saved after the turn and the rule is saved when pi closes", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  await world.pi.prompt(message, [])
  const during = [...(await vaultNotes(world.folders.globalVault)), ...(await vaultNotes(world.folders.projectVault))]
  expect(during.some((note) => note.text.includes("pnpm"))).toBe(false)
  await world.stop()
  const after = [...(await vaultNotes(world.folders.globalVault)), ...(await vaultNotes(world.folders.projectVault))]
  expect(after.some((note) => note.text.includes("pnpm"))).toBe(true)
})
```

**Step 2: Run**

Run `npx vitest run --project e2e tests/e2e/capture.e2e.test.ts`. Expected: 2 passed.
- **Unverified:** Haiku's capture judgement (ROADMAP item 4 says it is unproven).
- A failure is reported with the notes on disk. It is not tuned.

### Task B11: Delete the simulated tests scenario 5 replaces
```bash
rm tests/pi/capture/completion.test.ts tests/pi/capture/handlers.test.ts tests/pi/capture/runtime.test.ts tests/pi/capture/status.test.ts tests/usecases/capture-memory/capture-memory.run.test.ts tests/usecases/capture-memory/capture-memory.test.ts tests/usecases/capture-memory/refusal.test.ts tests/usecases/capture-memory/rounds.test.ts tests/usecases/capture-memory/semantic.test.ts tests/usecases/capture-memory/walk.test.ts tests/services/llm/capture.test.ts tests/services/llm/complete.test.ts tests/services/llm/lifetime.test.ts
```
Run `npm test`, `npm run typecheck` and `npm run lint`. Expected: pass.

**Commit (orchestrator):**
```bash
git add -A tests/e2e/capture.e2e.test.ts tests/pi tests/usecases tests/services
git commit -m "test(e2e): capture after a turn and at session end; remove its simulated tests"
```

### Task B12: Scenario 6 — vault guard, and the shipped skill

**Files:** Create `tests/e2e/vault-guard.e2e.test.ts`.

**Step 1: Write the test**
```ts
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { VAULT_ACCESS_REFUSAL } from "#src/domain"
import { e2eWorld, endOf, noteWithId, toolCallPrompt, toolText, writeVaultFile } from "#test-helpers"

test("read, write, bash and powershell on a vault file are refused and the file is unchanged", async () => {
  const world = await e2eWorld({ memory: "configured", tools: ["powershell"], modelCache: "shared", capture: "at-session-end" })
  await writeVaultFile(world.folders.globalVault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const note = join(world.folders.globalVault, "tools", "Use pnpm.md")
  const before = await readFile(note, "utf8")
  const calls = [
    { tool: "read", args: { path: note } },
    { tool: "write", args: { path: note, content: "replaced" } },
    { tool: "bash", args: { command: `cat '${note.replaceAll("\\", "/")}'` } },
    { tool: "powershell", args: { command: `Get-Content -LiteralPath '${note}'` } },
  ]
  for (const call of calls) {
    const turn = await world.pi.prompt(toolCallPrompt(call.tool, JSON.stringify(call.args)), [])
    const end = endOf(turn, call.tool)
    expect(end.isError).toBe(true)
    expect(toolText(end)).toContain(VAULT_ACCESS_REFUSAL)
  }
  expect(await readFile(note, "utf8")).toBe(before)
})

test("outside the vaults the read tool works, and pi lists the shipped obsidian-memory skill", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const outside = join(world.folders.cwd, "readme.txt")
  await writeFile(outside, "outside-7731")
  const turn = await world.pi.prompt(toolCallPrompt("read", JSON.stringify({ path: outside })), [])
  expect(endOf(turn, "read").isError).toBe(false)
  expect(toolText(endOf(turn, "read"))).toContain("outside-7731")
  expect(await world.pi.commands()).toContainEqual(expect.objectContaining({ name: "skill:obsidian-memory", source: "skill" }))
})
```
- Skills are listed as `skill:<name>` with `source: "skill"` (`pi-coding-agent/docs/rpc-commands.md:822-826`).
- Blocked calls carry the reason as the result text (`pi-agent-core/dist/agent-loop.js:507-516`).

**Step 2: Run**

Run `npx vitest run --project e2e tests/e2e/vault-guard.e2e.test.ts`. Expected: 2 passed.

### Task B13: Delete the simulated tests scenario 6 replaces, and the `pi` project
```bash
rm tests/pi/extension.smoke.test.ts tests/pi/vault-guard/vault-guard.test.ts
```
- In `vitest.config.ts`, remove the `pi` project object.
- In `package.json`, remove the `"test:pi"` script. Part 3 updates the AGENTS/README mentions.

Run `npm test`, `npm run typecheck` and `npm run lint`. Expected: pass.

**Commit (orchestrator):**
```bash
git add -A tests/e2e/vault-guard.e2e.test.ts tests/pi vitest.config.ts package.json
git commit -m "test(e2e): vault guard and shipped skill in the real pi; remove the fake-context smoke test"
```

### Task B14: Scenario 8 — semantic search, and the real model download

**Files:** Create `tests/e2e/semantic.e2e.test.ts` and `tests/services/embeddings/model-cache.model.test.ts`.

**Step 1: `tests/e2e/semantic.e2e.test.ts`**
```ts
import { expect, test } from "vitest"

import { e2eWorld, endOf, noteWithId, toolCallPrompt, toolText, writeVaultFile } from "#test-helpers"

test("memory_search finds a note by meaning, with no word in common, through the real local model", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const body = "Whenever the vacuum cleaner starts, the cat runs under the bed."
  await writeVaultFile(world.folders.globalVault, "pets/Our cat hides from the vacuum cleaner.md", noteWithId(1, body, []))
  await writeVaultFile(world.folders.globalVault, "tools/Use pnpm.md", noteWithId(2, "Always pnpm.", []))
  const search = { query: "kitty frightened by hoover noise", vault: "global" }
  const turn = await world.pi.prompt(toolCallPrompt("memory_search", JSON.stringify(search)), [])
  const end = endOf(turn, "memory_search")
  expect(end.isError).toBe(false)
  expect(toolText(end)).toContain("Our cat hides from the vacuum cleaner")
})
```
- **Unverified:** whether this paraphrase clears the local minimum similarity of 0.8 (`src/domain/embeddings/constants.ts:51-55`). If it fails, report the tool text. Don't change the query to share words.

**Step 2: `tests/services/embeddings/model-cache.model.test.ts`**

`provisionModelAsset` refuses an invalid asset rather than downloading it again (`src/services/embeddings/model-asset.ts:9-20`); removing the folder brings the download back.
```ts
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { inspectModelAsset, localModelAssets, provisionLocalModel } from "#src/services"
import { useTempFolder } from "#test-helpers"

test("downloads the local model from Hugging Face into an empty cache, every asset matching its pinned size and hash", async () => {
  const cachePath = await useTempFolder()
  const signal = new AbortController().signal
  const first = await provisionLocalModel({ cachePath, signal })
  if (!first.succeeded) throw new Error(`download failed: ${first.status}`)
  for (const asset of localModelAssets) {
    expect(await inspectModelAsset(join(first.output, asset.path), asset, signal)).toBe("valid")
  }
  const [config] = localModelAssets
  if (!config) throw new Error("no assets pinned")
  const configPath = join(first.output, config.path)
  expect(await inspectModelAsset(join(first.output, "absent.json"), config, signal)).toBe("missing")
  await writeFile(configPath, Buffer.alloc(config.bytes, 32))
  expect(await inspectModelAsset(configPath, config, signal)).toBe("invalid")
  await writeFile(configPath, "{}")
  expect(await inspectModelAsset(configPath, config, signal)).toBe("invalid")
  expect(await provisionLocalModel({ cachePath, signal })).toEqual({ succeeded: false, status: "unavailable" })
  await rm(first.output, { recursive: true })
  await mkdir(cachePath, { recursive: true })
  const again = await provisionLocalModel({ cachePath, signal })
  expect(again.succeeded).toBe(true)
  expect(await inspectModelAsset(configPath, config, signal)).toBe("valid")
})
```

**Step 3: Run**

Run `npx vitest run --project e2e tests/e2e/semantic.e2e.test.ts` and `npx vitest run --project model tests/services/embeddings/model-cache.model.test.ts`. Expected: 1 passed each. The model test downloads about 135 MB twice.

### Task B15: Delete the simulated tests scenario 8 and the download test replace
```bash
rm tests/pi/semantic/runtime.test.ts tests/usecases/semantic/prepare.test.ts tests/usecases/semantic/rank.test.ts tests/usecases/semantic/refresh-vectors.test.ts tests/usecases/search-memory/semantic-search.test.ts tests/services/embeddings/inference.test.ts tests/services/embeddings/local.test.ts tests/services/embeddings/local.load.test.ts tests/services/embeddings/operation.test.ts tests/services/embeddings/asset-download.test.ts tests/services/embeddings/model-asset.test.ts tests/services/embeddings/asset-inspection.test.ts
```
**Kept, waiting for the user's decision:** `tests/services/embeddings/openai.test.ts`, `google.test.ts` and `http.test.ts`.

Run `npm test`, `npm run typecheck` and `npm run lint`. Expected: pass.

**Commit (orchestrator):**
```bash
git add -A tests/e2e/semantic.e2e.test.ts tests/services/embeddings/model-cache.model.test.ts tests/pi tests/usecases tests/services
git commit -m "test(e2e): semantic search with the real local model and the real download; remove their simulated tests"
```

### Task B16: Remove helpers no test uses anymore

**Step 1: Create `tmp/unused-helpers.mjs` (write tool; `tmp/` is ignored by git)**
```js
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const sources = readdirSync("tests", { recursive: true })
  .filter((file) => file.endsWith(".ts"))
  .map((file) => readFileSync(join("tests", file), "utf8"))
for (const file of readdirSync("tests/helpers").filter((name) => name.endsWith(".ts") && name !== "index.ts")) {
  const text = readFileSync(join("tests/helpers", file), "utf8")
  for (const match of text.matchAll(/^export (?:async )?(?:function|const|class|interface|type) (\w+)/gm)) {
    const name = match[1]
    const uses = sources.reduce((count, source) => count + (source.match(new RegExp(`\\b${name}\\b`, "g")) || []).length, 0)
    if (uses <= 1) console.log(`${file} ${name}`)
  }
}
```

**Step 2: Run, delete what it lists, and repeat**

Run `node tmp/unused-helpers.mjs`.
- Delete each listed export with the edit tool, together with the imports that become unused.
- Delete a helper file once all its exports are gone, along with its line in `tests/helpers/index.ts`.
- Rerun until it prints nothing. Removing one export can orphan another.

**Step 3: Check that no simulation remains outside the kept files**
```bash
grep -rlE "fakePiContext|vi\.(fn|mock|spyOn)|setSystemTime|useFakeTimers|completionPort|fakeEmbedder|decisionServer|scriptedLaya|jevContext|syntheticModelAsset" tests
```
Expected: no output.
```bash
grep -rlE "embeddingServer" tests
```
Expected: exactly `tests/helpers/embeddings.ts`, `tests/services/embeddings/google.test.ts`, `tests/services/embeddings/http.test.ts` and `tests/services/embeddings/openai.test.ts`.

**Step 4: Full checks**

Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run test:e2e`. Expected: all pass. Record the e2e duration and cost lines in `docs/plans/2026-10-17-e2e-spikes.md` under "B16 full run".

**Step 5: Commit (orchestrator)**
```bash
git add -A tests/helpers docs/plans/2026-10-17-e2e-spikes.md
git commit -m "test: remove helpers left unused by the simulated tests"
```

---

## Lost coverage: real servers can't reproduce these (record in Part 3 docs)
- **Laya:** malformed or truncated responses and HTTP error details (`laya-response-tolerance`, parts of `laya-response` and `laya-batch`).
- **Model download:** network failure, an aborted download and a hash mismatch mid-transfer (`asset-download`, `model-asset`).
- **Jev:** abort and interruption timing (`interruption`).
- **Doctor:** the decision report for an unavailable Jev.

## Risks
- **Real-model judgement:** the Jev gate, the memory agent, capture and the paraphrase similarity are measured as they are. Any failure is reported, never tuned.
- **Midnight:** `localToday()` can disagree with the product's date if a test runs across midnight.
- **Mirror rule:** deleting `tests/pi/**` breaks the "every module has a mirrored test" rule. Part 3 writes the E2E exception into AGENTS.md.
- **Doc references:** docs/decision-thresholds.md still cites the label-flip comparison. Part 3 updates it.
