import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import type { ExecutedFile } from "#src/domain"
import { SHELL_EDIT_FIXTURE_FILES } from "./shell-edit-fixture.ts"

export function runsScript(path: string): ExecutedFile {
  return { kind: "script", path }
}

export function runsPackageScript(name: string): ExecutedFile {
  return { kind: "package-script", name, prefix: "" }
}

export function runsPackageScriptIn(prefix: string, name: string): ExecutedFile {
  return { kind: "package-script", name, prefix }
}

export async function resetShellEditProject(cwd: string): Promise<void> {
  for (const entry of await readdir(cwd)) await rm(join(cwd, entry), { recursive: true, force: true })
  for (const file of SHELL_EDIT_FIXTURE_FILES) {
    await mkdir(dirname(join(cwd, file.path)), { recursive: true })
    await writeFile(join(cwd, file.path), file.text)
  }
}

export async function changedFixtureFiles(cwd: string): Promise<string[]> {
  const changed: string[] = []
  for (const file of SHELL_EDIT_FIXTURE_FILES) {
    const text = await readFile(join(cwd, file.path), "utf8").then(
      (value) => value,
      () => "",
    )
    if (text !== file.text) changed.push(file.path)
  }
  return changed
}
