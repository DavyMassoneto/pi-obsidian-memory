import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { refreshFolders } from "#src/services"
import { aLimits } from "./limits.ts"

interface Tally {
  runs: number
  incomplete: number
  problems: string[]
}

function requiredArgument(position: number): string {
  const value = process.argv[position]
  if (!value) throw new Error(`missing child argument ${position}`)
  return value
}

const role = requiredArgument(2)
const vault = requiredArgument(3)
const folder = requiredArgument(4)
let stopping = false

process.on("message", (message) => {
  if (message && typeof message === "object" && "stop" in message) stopping = true
})

function errorText(error: Error): string {
  if ("code" in error && typeof error.code === "string") return `${error.code}: ${error.message}`
  return error.message
}

function isCompleteIndex(text: string): boolean {
  return text.startsWith("# ") && text.includes("## Notes") && text.endsWith("\n")
}

async function refreshInLoop(tally: Tally): Promise<void> {
  const context = { path: vault, name: "Memory", limits: aLimits() }
  while (!stopping) {
    const result = await refreshFolders(context, [folder], () => true, "with-ancestors")
    tally.runs += 1
    if (!result.succeeded) tally.problems.push(result.problems.join("; "))
  }
}

async function readInLoop(tally: Tally): Promise<void> {
  while (!stopping) {
    try {
      const text = await readFile(join(vault, folder, "index.md"), "utf8")
      tally.runs += 1
      if (!isCompleteIndex(text)) tally.incomplete += 1
    } catch (error) {
      if (!(error instanceof Error)) throw error
      tally.problems.push(errorText(error))
    }
  }
}

function send(message: Tally | string): Promise<void> {
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

async function main(): Promise<void> {
  const tally: Tally = { runs: 0, incomplete: 0, problems: [] }
  await send("ready")
  try {
    if (role === "refresher") await refreshInLoop(tally)
    if (role === "reader") await readInLoop(tally)
  } catch (error) {
    if (!(error instanceof Error)) throw error
    tally.problems.push(`threw ${errorText(error)}`)
  }
  await send(tally)
  process.exit(0)
}

await main()
