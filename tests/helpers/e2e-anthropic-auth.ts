import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

import Type, { type Static } from "typebox"
import { Value } from "typebox/value"

const ANTHROPIC_AUTH_PACKAGE = "@gotgenes/pi-anthropic-auth"
const NPM_PREFIX = "npm:"
const GIT_PREFIX = "git:"

const PackageEntrySchema = Type.Union([Type.String(), Type.Object({ source: Type.String() })])
const SettingsSchema = Type.Object({ packages: Type.Array(PackageEntrySchema) })
const PackageManifestSchema = Type.Object({
  name: Type.String(),
  pi: Type.Object({ extensions: Type.Array(Type.String()) }),
})

export async function anthropicAuthExtensionPaths(): Promise<string[]> {
  const agentDir = join(homedir(), ".pi", "agent")
  const settings = JSON.parse(await readTextOrEmptyJson(join(agentDir, "settings.json")))
  if (!Value.Check(SettingsSchema, settings)) throw new Error(missingMessage("the pi settings list no packages"))
  for (const entry of settings.packages) {
    for (const folder of packageFolders(agentDir, sourceOf(entry))) {
      const extensions = await anthropicAuthExtensionsIn(folder)
      if (extensions.length > 0) return extensions
    }
  }
  throw new Error(missingMessage("no package in the pi settings has that name"))
}

function sourceOf(entry: Static<typeof PackageEntrySchema>): string {
  if (typeof entry === "string") return entry
  return entry.source
}

function packageFolders(agentDir: string, source: string): string[] {
  if (source.startsWith(GIT_PREFIX)) return []
  if (!source.startsWith(NPM_PREFIX)) return [resolve(agentDir, withHomeExpanded(source))]
  const withoutVersion = source.slice(NPM_PREFIX.length).replace(/(?<=.)@.*$/, "")
  return [join(agentDir, "npm", "node_modules", withoutVersion)]
}

function withHomeExpanded(path: string): string {
  if (path === "~") return homedir()
  if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2))
  return path
}

async function anthropicAuthExtensionsIn(folder: string): Promise<string[]> {
  const manifest = JSON.parse(await readTextOrEmptyJson(join(folder, "package.json")))
  if (!Value.Check(PackageManifestSchema, manifest)) return []
  if (manifest.name !== ANTHROPIC_AUTH_PACKAGE) return []
  return manifest.pi.extensions.map((extension) => resolve(folder, extension))
}

async function readTextOrEmptyJson(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8")
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return "{}"
    throw new Error(`Cannot read ${path}`, { cause: error })
  }
}

function missingMessage(reason: string): string {
  return `The E2E needs ${ANTHROPIC_AUTH_PACKAGE} (${reason}): without it Anthropic rejects pi's subscription token with "Third-party apps now draw from your extra usage". Install it in the user's pi.`
}
