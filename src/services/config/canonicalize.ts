import { lstat, realpath, stat } from "node:fs/promises"
import { isAbsolute, join, parse, resolve, sep } from "node:path"

import {
  configLocationProblems,
  infrastructureProblems,
  type MemoryConfig,
  type ProjectEntry,
  parseConfig,
  registrationProblems,
} from "#/domain"
import type {
  CanonicalConfigResult,
  CanonicalPathResult,
  ConfigRegistrationLocation,
  ConfigRegistrationLocationResult,
  RegistrationPaths,
  RegistrationPathsResult,
} from "./types.ts"

export async function canonicalizeRegistration(request: RegistrationPaths): Promise<RegistrationPathsResult> {
  const location = await canonicalizeConfigLocation(request)
  const index = await canonicalField(request.indexPath, "indexPath", "directory")
  const problems: string[] = []
  if (!location.succeeded) problems.push(...location.problems)
  if (!index.succeeded) problems.push(...index.problems)
  if (!location.succeeded || !index.succeeded) {
    return { succeeded: false, problems }
  }

  const canonical = { ...location.output, indexPath: index.output }
  problems.push(...infrastructureProblems(request), ...infrastructureProblems(canonical))
  if (problems.length > 0) {
    return { succeeded: false, problems: [...new Set(problems)] }
  }

  return { succeeded: true, output: canonical }
}

export async function canonicalizeConfigLocation(
  request: ConfigRegistrationLocation,
): Promise<ConfigRegistrationLocationResult> {
  const parsed = parseConfig(JSON.stringify(request.config))
  if (!parsed.succeeded) {
    return parsed
  }

  const config = await canonicalConfig(parsed.output)
  const path = await canonicalField(request.configPath, "configPath", "file")
  const problems: string[] = []
  if (!config.succeeded) problems.push(...config.problems)
  if (!path.succeeded) problems.push(...path.problems)
  if (!config.succeeded || !path.succeeded) {
    return { succeeded: false, problems }
  }

  const canonical = { config: config.output, configPath: path.output }
  problems.push(
    ...registrationProblems(canonical.config),
    ...configLocationProblems(request),
    ...configLocationProblems(canonical),
  )
  if (problems.length > 0) {
    return { succeeded: false, problems: [...new Set(problems)] }
  }

  return { succeeded: true, output: canonical }
}

async function canonicalConfig(config: MemoryConfig): Promise<CanonicalConfigResult> {
  const problems: string[] = []
  const global = await canonicalField(config.global.vault, "global.vault", "directory")
  if (!global.succeeded) problems.push(...global.problems)

  const projects: ProjectEntry[] = []
  for (const [index, project] of config.projects.entries()) {
    const folder = await canonicalField(project.folder, `projects.${index}.folder`, "directory")
    const vault = await canonicalField(project.vault, `projects.${index}.vault`, "directory")
    if (!folder.succeeded) problems.push(...folder.problems)
    if (!vault.succeeded) problems.push(...vault.problems)
    if (folder.succeeded && vault.succeeded) {
      projects.push({ ...project, folder: folder.output, vault: vault.output })
    }
  }
  if (!global.succeeded || problems.length > 0) {
    return { succeeded: false, problems }
  }

  return { succeeded: true, output: { ...config, global: { vault: global.output }, projects } }
}

async function canonicalField(path: string, field: string, kind: "file" | "directory"): Promise<CanonicalPathResult> {
  try {
    if (kind === "directory") {
      return { succeeded: true, output: await canonicalDirectory(path) }
    }

    return { succeeded: true, output: await canonicalPath(path) }
  } catch (error) {
    return { succeeded: false, problems: [`${field}: ${String(error)}`] }
  }
}

async function canonicalDirectory(path: string): Promise<string> {
  const canonical = await canonicalPath(path)

  try {
    if (!(await stat(canonical)).isDirectory()) {
      throw new Error(`${path}: expected a directory`)
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error
    }
  }

  return canonical
}

async function canonicalPath(path: string): Promise<string> {
  if (!isFullyQualifiedPath(path)) {
    throw new Error(`${path}: expected a fully qualified absolute path on this platform`)
  }

  const absolute = resolve(path)
  const root = parse(absolute).root
  const parts = absolute.slice(root.length).split(sep).filter(Boolean)
  let current = await realpath(root)

  for (const [index, part] of parts.entries()) {
    if (!(await stat(current)).isDirectory()) {
      throw new Error(`${current}: expected an existing ancestor directory`)
    }
    const candidate = join(current, part)
    try {
      await lstat(candidate)
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return join(current, ...parts.slice(index))
      }
      throw error
    }
    current = await realpath(candidate)
  }

  return current
}

function isFullyQualifiedPath(path: string): boolean {
  if (!isAbsolute(path)) {
    return false
  }

  const root = parse(path).root.replaceAll("\\", "/")
  if (sep === "\\" && !root.includes(":") && !root.startsWith("//")) {
    return false
  }

  return true
}
