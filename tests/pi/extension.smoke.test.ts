import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline"
import type { Readable } from "node:stream"

import { expect, test } from "vitest"

const repoRoot = resolve(import.meta.dirname, "..", "..")
const piCli = join(repoRoot, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js")
const loadedMessage = "pi-obsidian-memory loaded"

test("pi loads the extension from the package", async () => {
  // An empty agent dir and --no-extensions keep the user's real pi config and extensions out of the test.
  const agentDir = await mkdtemp(join(tmpdir(), "pi-smoke-"))
  const pi = spawn(
    process.execPath,
    [piCli, "--mode", "rpc", "--no-session", "--offline", "--no-extensions", "-e", repoRoot],
    // Below vitest's testTimeout, so a missing message ends here and the finally block still cleans up.
    { cwd: agentDir, env: { ...process.env, PI_CODING_AGENT_DIR: agentDir }, timeout: 20_000 },
  )
  const exited = once(pi, "exit")
  try {
    const line = await firstLineContaining(pi.stdout, loadedMessage)
    expect(JSON.parse(line)).toMatchObject({
      type: "extension_ui_request",
      method: "notify",
      message: loadedMessage,
      notifyType: "info",
    })
  } finally {
    pi.kill()
    await exited
    await rm(agentDir, { recursive: true, force: true })
  }
})

async function firstLineContaining(stream: Readable, text: string): Promise<string> {
  for await (const line of createInterface({ input: stream })) {
    if (line.includes(text)) {
      return line
    }
  }
  throw new Error(`pi exited without printing "${text}"`)
}
