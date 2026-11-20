import { type ChildProcess, fork } from "node:child_process"
import { fileURLToPath } from "node:url"

import { onTestFinished } from "vitest"

import {
  type ChildCommand,
  type ChildReport,
  type ChildRole,
  type CommandType,
  type IndexOperation,
  type ReportType,
  reportOf,
} from "./index-lock-wire.ts"

const CHILD_ENTRY = fileURLToPath(new URL("./index-lock-child.ts", import.meta.url))
const WAIT_WINDOW_MS = 1000

type ReportCheck = () => boolean

export class IndexChild {
  readonly #process: ChildProcess
  readonly #reports: ChildReport[] = []
  readonly #checks: ReportCheck[] = []
  #exited = false

  constructor(role: ChildRole, indexPath: string, argument: string) {
    this.#process = fork(CHILD_ENTRY, [role, indexPath, argument], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      execArgv: [],
    })
    this.#process.on("message", (message) => {
      const report = reportOf(message)
      if (report) this.#reports.push(report)
      this.#settle()
    })
    this.#process.on("exit", () => {
      this.#exited = true
      this.#settle()
    })
    onTestFinished(() => this.#ended())
  }

  #ended(): Promise<void> {
    return new Promise((resolve) => {
      if (this.#exited) {
        resolve()
        return
      }
      this.#process.once("exit", () => resolve())
      this.#process.kill("SIGKILL")
    })
  }

  send(type: CommandType): void {
    const command: ChildCommand = { type }
    this.#process.send(command)
  }

  kill(): void {
    this.#process.kill("SIGKILL")
  }

  waitFor(type: ReportType): Promise<ChildReport> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const failed = this.#reports.find((report) => report.type === "failed")
        if (failed) {
          reject(new Error(failed.outcome))
          return true
        }
        const found = this.#reports.find((report) => report.type === type)
        if (found) {
          resolve(found)
          return true
        }
        if (!this.#exited) return false
        reject(new Error(`child exited before ${type}`))
        return true
      }
      if (!check()) this.#checks.push(check)
    })
  }

  #settle(): void {
    for (const check of [...this.#checks]) {
      if (check()) this.#checks.splice(this.#checks.indexOf(check), 1)
    }
  }
}

export async function holdingProcess(indexPath: string): Promise<IndexChild> {
  const holder = new IndexChild("holder", indexPath, "none")
  await holder.waitFor("held")
  return holder
}

export function operatingProcess(indexPath: string, operation: IndexOperation): IndexChild {
  return new IndexChild("operator", indexPath, operation)
}

export function recoveringProcess(indexPath: string, noteId: string): IndexChild {
  return new IndexChild("recoverer", indexPath, noteId)
}

export async function insideWaitWindow<T>(answer: Promise<T>): Promise<void> {
  await Promise.race([answer, new Promise<void>((resolve) => setTimeout(resolve, WAIT_WINDOW_MS))])
}
