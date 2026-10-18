import { join, resolve } from "node:path"

export const repoRoot = resolve(import.meta.dirname, "..", "..")

export const E2E_PROVIDER = "omni"

export const E2E_MODEL = "cc/claude-haiku-5-5"

export const E2E_PROJECT_NAME = "e2e-project"

export function piCliPath(): string {
  return join(repoRoot, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js")
}

export function extensionPath(): string {
  return join(repoRoot, "src", "pi", "extension.ts")
}

export function skillsPath(): string {
  return join(repoRoot, "skills")
}
