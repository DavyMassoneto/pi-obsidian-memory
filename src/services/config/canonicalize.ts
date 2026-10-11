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
  ConfigRegistrationLocation,
  ConfigRegistrationLocationResult,
  RegistrationPaths,
  RegistrationPathsResult,
} from "./types.ts"

export async function canonicalizeRegistration(request: RegistrationPaths): Promise<RegistrationPathsResult> {
  const location = await canonicalizeConfigLocation(request)
  if (!location.succeeded) {
    return location
  }
  try {
    const canonical = { ...location.output, indexPath: await canonicalDirectory(request.indexPath) }
    const problems = [...infrastructureProblems(request), ...infrastructureProblems(canonical)]
    if (problems.length > 0) {
      return { succeeded: false, problems: [...new Set(problems)] }
    }
    return { succeeded: true, output: canonical }
  } catch (error) {
    return { succeeded: false, problems: [String(error)] }
  }
}

export async function canonicalizeConfigLocation(
  request: ConfigRegistrationLocation,
): Promise<ConfigRegistrationLocationResult> {
  const parsed = parseConfig(JSON.stringify(request.config))
  if (!parsed.succeeded) {
    return parsed
  }
  try {
    const canonical = {
      config: await canonicalConfig(parsed.output),
      configPath: await canonicalPath(request.configPath),
    }
    const problems = [
      ...registrationProblems(canonical.config),
      ...configLocationProblems(request),
      ...configLocationProblems(canonical),
    ]
    if (problems.length > 0) {
      return { succeeded: false, problems: [...new Set(problems)] }
    }
    return { succeeded: true, output: canonical }
  } catch (error) {
    return { succeeded: false, problems: [String(error)] }
  }
}

async function canonicalConfig(config: MemoryConfig): Promise<MemoryConfig> {
  const projects: ProjectEntry[] = []
  for (const project of config.projects) {
    projects.push({
      ...project,
      folder: await canonicalDirectory(project.folder),
      vault: await canonicalDirectory(project.vault),
    })
  }
  return { ...config, global: { vault: await canonicalDirectory(config.global.vault) }, projects }
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
