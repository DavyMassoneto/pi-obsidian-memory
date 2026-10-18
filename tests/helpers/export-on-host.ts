import {
  type ExportMemoryRequest,
  type ExportMemoryResult,
  exportMemory as exportMemoryOn,
  type MemoryOperationContext,
} from "#src/usecases"
import { testPlatform } from "./test-platform.ts"

export function exportMemory(
  request: Omit<ExportMemoryRequest, "platform">,
  context: MemoryOperationContext,
): Promise<ExportMemoryResult> {
  return exportMemoryOn({ ...request, platform: testPlatform() }, context)
}
