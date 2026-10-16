import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import type { DefaultResourceLoader } from "@earendil-works/pi-coding-agent"
import Type from "typebox"
import { Value } from "typebox/value"

import { type MemoryPiContext, memoryConfigPath } from "#src/pi"
import { toolCallEvent } from "./pi-prompt.ts"
import { productSettings } from "./settings.ts"

const BlockedSchema = Type.Object({ block: Type.Literal(true) })

export async function guardedReads(loader: DefaultResourceLoader, agentDir: string, context: MemoryPiContext) {
  const vault = join(agentDir, "smoke-vault")
  await mkdir(vault)
  const config = { global: { vault }, projects: [], ...productSettings() }
  const configPath = memoryConfigPath(agentDir)
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify(config))
  const results = { inside: false, outside: false }
  for (const extension of loader.getExtensions().extensions) {
    const handlers = extension.handlers.get("tool_call")
    if (!handlers) continue
    for (const handler of handlers) {
      const inside = await handler(toolCallEvent("read", { path: join(vault, "Note.md") }), context)
      const outside = await handler(toolCallEvent("read", { path: join(agentDir, "other.txt") }), context)
      if (Value.Check(BlockedSchema, inside)) results.inside = true
      if (Value.Check(BlockedSchema, outside)) results.outside = true
    }
  }
  return results
}
