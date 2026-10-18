import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import { chmod } from "node:fs/promises"
import { dirname, join } from "node:path"

export async function holdFileContentsLocked(path: string) {
  if (process.platform !== "win32") {
    await chmod(path, 0o000)
    return () => chmod(path, 0o644)
  }
  const systemRoot = process.env.SystemRoot
  if (typeof systemRoot !== "string") throw new Error("SystemRoot is required for the Windows lock fixture")
  const child = spawn(
    join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$ErrorActionPreference='Stop'; $path=[Console]::ReadLine(); " +
        "$file=[IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $file.Lock(0, $file.Length); " +
        "try { [Console]::WriteLine('ready'); [Console]::Out.Flush(); [Console]::ReadLine() | Out-Null } " +
        "finally { $file.Dispose() }",
    ],
    { cwd: dirname(path), env: { SystemRoot: systemRoot }, windowsHide: true, timeout: 30000 },
  )
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()))
  const release = async () => {
    child.stdin.end("\n")
    await closed
  }
  try {
    await waitUntilLocked(child, path)
    return release
  } catch (error) {
    child.kill()
    throw error
  }
}

function waitUntilLocked(child: ChildProcessWithoutNullStreams, path: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let output = ""
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8")
      if (output.trim() === "ready") resolve()
    })
    child.once("error", reject)
    child.once("close", () => reject(new Error("Lock fixture exited before readiness")))
    child.stdin.on("error", reject)
    child.stdin.write(`${path}\n`)
  })
}
