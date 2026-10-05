import { CLAUDE_CODE_AUTO_MEMORY_SWITCH, SWITCHED_ON } from "./constants.ts"

export function disableClaudeCodeAutoMemory(env: NodeJS.ProcessEnv): void {
  env[CLAUDE_CODE_AUTO_MEMORY_SWITCH] = SWITCHED_ON
}
