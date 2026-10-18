import { onTestFinished } from "vitest"

import { RpcPi } from "./e2e-rpc.ts"
import { type E2eWorld, piArgs } from "./e2e-world.ts"

export async function piWithoutCredentials(world: E2eWorld): Promise<Pick<E2eWorld, "pi">> {
  await world.pi.stop()
  const pi = new RpcPi({
    cwd: world.folders.cwd,
    agentDir: world.folders.agentDir,
    args: piArgs(world.options),
    credentials: null,
    omitTypesafeKey: false,
    offlineNpmCache: null,
  })
  onTestFinished(({ task }) => {
    if (task.result?.state === "fail") console.error(pi.diagnostics)
    return pi.stop()
  })
  return { pi }
}
