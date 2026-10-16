import { execFile } from "node:child_process"
import { realpath } from "node:fs/promises"
import { dirname, join } from "node:path"
import { promisify } from "node:util"

import { indexFileFor, readIndexInventory, recoverIndex, searchCatalog } from "#/services"
import type { MemoryOperationContext } from "#/usecases"

export async function denySynchronizationRead(path: string) {
  const systemRoot = process.env.SystemRoot
  if (typeof systemRoot !== "string") throw new Error("SystemRoot required for Windows read denial")
  const executable = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
  const command = promisify(execFile)
  const options = {
    cwd: dirname(path),
    env: { SystemRoot: systemRoot, MEMORY_TEST_PATH: path },
    windowsHide: true,
    timeout: 15000,
  }
  const args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]
  const before = await command(
    executable,
    [...args, "$ErrorActionPreference='Stop'; [Console]::Write((Get-Acl -LiteralPath $env:MEMORY_TEST_PATH).Sddl)"],
    options,
  )
  const restore = async () => {
    const restored = await command(
      executable,
      [
        ...args,
        "$ErrorActionPreference='Stop'; $acl=Get-Acl -LiteralPath $env:MEMORY_TEST_PATH; " +
          "$acl.SetSecurityDescriptorSddlForm($env:MEMORY_TEST_SDDL); " +
          "Set-Acl -LiteralPath $env:MEMORY_TEST_PATH -AclObject $acl; " +
          "[Console]::Write((Get-Acl -LiteralPath $env:MEMORY_TEST_PATH).Sddl)",
      ],
      { ...options, env: { ...options.env, MEMORY_TEST_SDDL: before.stdout } },
    )
    if (restored.stdout !== before.stdout) throw new Error("Temporary fixture ACL was not restored exactly")
  }
  try {
    await command(
      executable,
      [
        ...args,
        "$ErrorActionPreference='Stop'; $acl=Get-Acl -LiteralPath $env:MEMORY_TEST_PATH; " +
          "$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; " +
          "$rule=New-Object Security.AccessControl.FileSystemAccessRule($sid, 'ReadData', 'Deny'); " +
          "$acl.AddAccessRule($rule); Set-Acl -LiteralPath $env:MEMORY_TEST_PATH -AclObject $acl",
      ],
      options,
    )
  } catch (error) {
    await restore()
    throw error
  }
  return restore
}

export async function synchronizedIndexPath(context: MemoryOperationContext, vault: string): Promise<string> {
  return indexFileFor(context.indexPath, await realpath(vault))
}

export function synchronizedCatalog(path: string) {
  const opened = recoverIndex({ path })
  if (!opened.succeeded) throw new Error(opened.problems.join("; "))
  try {
    const inventory = readIndexInventory(opened.output)
    const hits = searchCatalog(opened.output, { query: "memory", limit: 100 })
    if (!inventory.succeeded || !hits.succeeded) throw new Error("catalog unavailable")
    return { inventory: inventory.output, hits: hits.output }
  } finally {
    opened.output.close()
  }
}
