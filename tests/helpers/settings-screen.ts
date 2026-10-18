import { mkdir, readFile } from "node:fs/promises"

import { settingLines } from "#src/pi"
import type { MemoryConfig } from "#src/services"
import { registrationUsecaseFixture, writeRegistrationSnapshot } from "./registration-usecases.ts"

export function lineLabels(config: MemoryConfig): string[] {
  return settingLines(config).map((line) => line.label)
}

export async function configuredSettings() {
  const fixture = await registrationUsecaseFixture()
  await mkdir(fixture.config.global.vault)
  const hash = await writeRegistrationSnapshot(fixture.context, JSON.stringify(fixture.config))
  return { ...fixture, hash }
}

export async function writtenConfig(path: string) {
  return JSON.parse(await readFile(path, "utf8"))
}
