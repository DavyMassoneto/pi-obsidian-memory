import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const repoRoot = resolve(import.meta.dirname, "..", "..")

export const E2E_PROVIDER = "omni"

export const E2E_MODEL = "cc/claude-haiku-5-5"

export const E2E_PROJECT_NAME = "e2e-project"

export function piCliPath(): string {
  return fileURLToPath(new URL("./bundle/cli.js", import.meta.resolve("@earendil-works/pi-coding-agent")))
}

export function extensionPath(): string {
  return join(repoRoot, "src", "pi", "extension.ts")
}

export function skillsPath(): string {
  return join(repoRoot, "skills")
}
