import type { MemoryConfig } from "#src/services"
import type { CompactSessionResult } from "#src/usecases"
import { writeRegistrationSnapshot } from "./registration-usecases.ts"
import { searchFixture } from "./search-memory.ts"

export function summaryOf(result: CompactSessionResult): string {
  if (!result.succeeded) throw new Error(result.problems.join("\n"))
  return result.output.summary
}

export async function compactionFixture(compaction: MemoryConfig["compaction"]) {
  const fixture = await searchFixture()
  await writeRegistrationSnapshot(fixture.context, JSON.stringify({ ...fixture.config, compaction }))
  return fixture
}
