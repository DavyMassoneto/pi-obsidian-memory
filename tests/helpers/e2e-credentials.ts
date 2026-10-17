import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { piCliPath } from "./e2e-paths.ts"

const run = promisify(execFile)

export interface PiCredentialsEnv {
  ANTHROPIC_OAUTH_TOKEN: string
  TYPESAFE_API_KEY: string
}

export async function piCredentialsEnv(): Promise<PiCredentialsEnv> {
  const anthropic = await printedByPi(["auth", "print-bearer-token", "--provider", "anthropic"])
  const typesafe = await printedByPi(["auth", "print-api-key", "--provider", "typesafe"])
  return { ANTHROPIC_OAUTH_TOKEN: anthropic, TYPESAFE_API_KEY: typesafe }
}

async function printedByPi(args: string[]): Promise<string> {
  const env = { ...process.env }
  delete env.PI_CODING_AGENT_DIR
  const [group, command, , provider] = args
  let stdout = ""
  try {
    stdout = (await run(process.execPath, [piCliPath(), ...args], { env })).stdout
  } catch (error) {
    let exitCode = "unknown"
    if (error instanceof Error && "code" in error) exitCode = String(error.code)
    throw new Error(`pi ${group} ${command} for ${provider} failed with exit code ${exitCode}`)
  }
  const value = stdout.trim()
  if (value === "") throw new Error(`pi ${group} ${command} for ${provider} printed nothing`)
  if (/[\r\n]/.test(value)) throw new Error(`pi ${group} ${command} for ${provider} printed more than one line`)
  return value
}
