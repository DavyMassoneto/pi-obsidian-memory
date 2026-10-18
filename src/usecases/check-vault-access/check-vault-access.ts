import { readConfig, VAULT_ACCESS_REFUSAL } from "#src/services"
import { isRawDevicePath } from "./raw-device.ts"
import { guardedTargets, hitsTargets } from "./targets.ts"
import type { CheckVaultAccessInput, CheckVaultAccessResult } from "./types.ts"

export async function checkVaultAccess(input: CheckVaultAccessInput): Promise<CheckVaultAccessResult> {
  const { request, cwd, home, platform } = input
  const config = await readConfig(input.configPath)
  if (!config.succeeded) return allowed()
  const written = [config.output.global.vault, ...config.output.projects.map((project) => project.vault)]
  if (request.kind !== "command" && isRawDevicePath(request.path, cwd, platform)) return refusal()
  const targets = await guardedTargets(written)
  if (await hitsTargets({ request, cwd, home, platform, targets })) return refusal()
  return allowed()
}

function refusal(): CheckVaultAccessResult {
  return { succeeded: false, reason: "vault-access", problems: [VAULT_ACCESS_REFUSAL] }
}

function allowed(): CheckVaultAccessResult {
  return { succeeded: true }
}
