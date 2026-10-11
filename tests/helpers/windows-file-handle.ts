import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import { dirname, join } from "node:path"

export async function holdFileWithoutDeleteSharing(path: string) {
  const systemRoot = process.env.SystemRoot
  if (typeof systemRoot !== "string") throw new Error("SystemRoot is required for the Windows handle fixture")
  const child = spawn(
    join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$ErrorActionPreference='Stop'; $path=[Console]::ReadLine(); " +
        "$file=[IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); " +
        "try { [Console]::WriteLine('ready'); [Console]::Out.Flush(); [Console]::ReadLine() | Out-Null } " +
        "finally { $file.Dispose() }",
    ],
    { cwd: dirname(path), env: { SystemRoot: systemRoot }, windowsHide: true, timeout: 15000 },
  )
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()))
  const release = () => releaseHandle(child, closed)
  try {
    await waitForHandle(child, path)
    return release
  } catch (error) {
    await release()
    throw error
  }
}

async function waitForHandle(child: ChildProcessWithoutNullStreams, path: string): Promise<void> {
  let output = ""
  let errors = ""
  const ready = new Promise<void>((resolve, reject) => {
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8")
      if (output.trim() === "ready") resolve()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      errors += chunk.toString("utf8")
    })
    child.once("error", reject)
    child.once("close", () => reject(new Error(`Handle fixture exited before readiness: ${errors}`)))
    child.stdin.on("error", reject)
    child.stdin.write(`${path}\n`)
  })
  await boundedHandleWait(ready, 5000)
}

async function releaseHandle(child: ChildProcessWithoutNullStreams, closed: Promise<void>): Promise<void> {
  child.stdin.end("\n")
  const forceExit = setTimeout(() => child.kill(), 2000)
  try {
    await boundedHandleWait(closed, 5000)
  } finally {
    clearTimeout(forceExit)
    if (typeof child.exitCode !== "number") child.kill()
  }
}

async function boundedHandleWait(operation: Promise<void>, milliseconds: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Windows handle fixture timed out")), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}
