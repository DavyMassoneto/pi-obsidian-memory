import { checkChatModels } from "#src/services"
import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#src/usecases/operation-context"
import { resolveLeasedMemory } from "#src/usecases/resolve-memory/leased"
import type { DiagnosedMemory, DiagnoseMemoryRequest, DiagnoseMemoryResult, ModelReport } from "./types.ts"
import { reportVault } from "./vault.ts"

export async function diagnoseMemory<TModel>(
  request: DiagnoseMemoryRequest<TModel>,
  callerContext: MemoryOperationContext,
): Promise<DiagnoseMemoryResult> {
  const context = captureMemoryOperationContext(callerContext)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const memory = await resolveLeasedMemory(context)
    if (!memory.succeeded) return memory
    const targets = [memory.output.global]
    let projectMissing = true
    if (memory.output.project) {
      targets.push(memory.output.project)
      projectMissing = false
    }
    const vaults: DiagnosedMemory["vaults"] = []
    for (const target of targets) vaults.push(await reportVault(memory.output, target, context))
    const { capture, memoryAgent } = memory.output.config
    const checks = await checkChatModels([capture.model, memoryAgent.model], request.port)
    const models: ModelReport[] = []
    const [captureCheck, agentCheck] = checks
    if (captureCheck) models.push({ role: "capture", check: captureCheck })
    if (agentCheck) models.push({ role: "memory agent", check: agentCheck })
    const interrupted = memoryOperationInterruption(context)
    if (interrupted) return interrupted
    return {
      succeeded: true,
      output: { vaults, projectMissing, maxNotesPerFolder: memory.output.config.limits.maxNotesPerFolder, models },
    }
  } finally {
    lease.release()
  }
}
