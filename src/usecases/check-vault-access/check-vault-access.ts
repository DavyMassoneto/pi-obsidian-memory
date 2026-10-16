import { readConfig, VAULT_ACCESS_REFUSAL } from "#src/services"
import { CONFIG_PROTECTED_PROBLEM } from "./constants.ts"
import { isRawDevicePath } from "./raw-device.ts"
import { guardedTargets, hitsTargets } from "./targets.ts"
import type { CheckVaultAccessInput, CheckVaultAccessResult } from "./types.ts"

export async function checkVaultAccess(input: CheckVaultAccessInput): Promise<CheckVaultAccessResult> {
  const { request, cwd, home } = input
  if (request.kind === "config-write") {
    const targets = await guardedTargets([input.dataFolder])
    if (await hitsTargets({ request: { kind: "file", path: request.path }, cwd, home, targets }))
      return protectedConfig()
    return allowed()
  }
  if (request.kind === "command") {
    const targets = await guardedTargets([input.dataFolder])
    if (await hitsTargets({ request, cwd, home, targets })) return protectedConfig()
  }
  const config = await readConfig(input.configPath)
  if (!config.succeeded) return allowed()
  const written = [config.output.global.vault, ...config.output.projects.map((project) => project.vault)]
  if (request.kind !== "command" && isRawDevicePath(request.path, cwd)) return refusal()
  const targets = await guardedTargets(written)
  if (await hitsTargets({ request, cwd, home, targets })) return refusal()
  return allowed()
}

function refusal(): CheckVaultAccessResult {
  return { succeeded: false, reason: "vault-access", problems: [VAULT_ACCESS_REFUSAL] }
}

function protectedConfig(): CheckVaultAccessResult {
  return { succeeded: false, reason: "config-protected", problems: [CONFIG_PROTECTED_PROBLEM] }
}

function allowed(): CheckVaultAccessResult {
  return { succeeded: true }
}
