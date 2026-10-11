import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent"

import { disableClaudeCodeAutoMemory } from "#/pi/claude-code"
import { memoryAddTool, memoryConfigPath } from "#/pi/memory-add"
import type { ExtensionRegistrar } from "./types.ts"

export default function extension(pi: ExtensionAPI): void {
  registerExtension(pi, getAgentDir(), process.env)
}

export function registerExtension(registrar: ExtensionRegistrar, agentDir: string, env: NodeJS.ProcessEnv): void {
  disableClaudeCodeAutoMemory(env)
  registrar.registerTool(memoryAddTool(memoryConfigPath(agentDir)))
}
