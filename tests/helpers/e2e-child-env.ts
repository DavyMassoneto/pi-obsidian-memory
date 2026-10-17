import type { RpcStart } from "./e2e-rpc-types.ts"

const CREDENTIAL_VARIABLE = /API_KEY|AUTH_TOKEN|OAUTH_TOKEN/

export function childEnv(start: RpcStart): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...start.credentials,
    PI_CODING_AGENT_DIR: start.agentDir,
    PI_SKIP_VERSION_CHECK: "1",
    PI_TELEMETRY: "0",
  }
  delete env.ANTHROPIC_AUTH_TOKEN
  delete env.ANTHROPIC_API_KEY
  if (start.credentials) return env
  for (const name of Object.keys(env)) if (CREDENTIAL_VARIABLE.test(name)) delete env[name]
  return env
}
