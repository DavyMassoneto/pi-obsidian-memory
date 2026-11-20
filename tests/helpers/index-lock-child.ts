import { acquireIndexLock, recoverIndex } from "#src/services"
import { runIndexOperation } from "./index-lock-operations.ts"
import { type ChildReport, type CommandType, commandNamed, operationNamed } from "./index-lock-wire.ts"
import { entryWith } from "./search-index.ts"

function requiredArgument(position: number): string {
  const value = process.argv[position]
  if (!value) throw new Error(`missing child argument ${position}`)
  return value
}

const role = requiredArgument(2)
const indexPath = requiredArgument(3)
const argument = requiredArgument(4)

type ResolveWait = () => void

interface CommandWaiter {
  wanted: CommandType
  resolve: ResolveWait
}

const received: CommandType[] = []
const waiters: CommandWaiter[] = []

process.on("message", (message) => {
  if (!message || typeof message !== "object") return
  const command = commandNamed(message)
  if (!command) return
  received.push(command)
  for (const waiter of waiters) {
    if (received.includes(waiter.wanted)) waiter.resolve()
  }
})

function waitForCommand(wanted: CommandType): Promise<void> {
  return new Promise((resolve) => {
    waiters.push({ wanted, resolve })
    if (received.includes(wanted)) resolve()
  })
}

function report(message: ChildReport): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.send) {
      reject(new Error("not forked with a channel"))
      return
    }
    process.send(message, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

function openedByRecovery() {
  const recovered = recoverIndex({ path: indexPath })
  if (!recovered.succeeded) throw new Error(recovered.problems.join("; "))
  return recovered
}

async function hold(): Promise<void> {
  const lock = acquireIndexLock(indexPath)
  if (!lock.succeeded) throw new Error(lock.problems.join("; "))
  const released = waitForCommand("release")
  await report({ type: "held", outcome: "" })
  await released
  lock.output.release()
}

async function operate(name: string): Promise<void> {
  const operation = operationNamed(name)
  const called = waitForCommand("call")
  if (operation !== "open") {
    const opened = openedByRecovery()
    await report({ type: "opened", outcome: "" })
    await called
    await report({ type: "ready", outcome: "" })
    const outcome = runIndexOperation(opened.output, operation)
    opened.output.close()
    await report({ type: "done", outcome })
    return
  }
  await called
  await report({ type: "ready", outcome: "" })
  const opened = openedByRecovery()
  const outcome = runIndexOperation(opened.output, operation)
  opened.output.close()
  await report({ type: "done", outcome })
}

async function recoverAndWrite(): Promise<void> {
  await report({ type: "ready", outcome: "" })
  const opened = openedByRecovery()
  const written = waitForCommand("write")
  await report({ type: "recovered", outcome: String(opened.rebuilt) })
  await written
  const put = opened.output.put(entryWith(argument, `Note of ${argument}`, `Body of ${argument}`))
  opened.output.close()
  await report({ type: "written", outcome: JSON.stringify(put) })
}

async function main(): Promise<void> {
  try {
    if (role === "holder") await hold()
    if (role === "operator") await operate(argument)
    if (role === "recoverer") await recoverAndWrite()
  } catch (error) {
    if (!(error instanceof Error)) throw error
    await report({ type: "failed", outcome: error.message })
  }
  process.exit(0)
}

await main()
