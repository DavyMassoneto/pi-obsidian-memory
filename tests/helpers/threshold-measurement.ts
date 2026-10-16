import { decideMemory, scoreCandidates } from "#src/services"
import { gateFixture } from "./gate-fixtures.ts"
import { liveLayaContext } from "./laya-live.ts"
import { relevanceFixture } from "./relevance-fixtures.ts"
import type { ScoredExample } from "./threshold-report.ts"

export async function measureGate(): Promise<ScoredExample[]> {
  const scored: ScoredExample[] = []
  for (const [index, example] of gateFixture.entries()) {
    const result = await decideMemory({
      context: liveLayaContext(),
      request: { message: example.message, project: example.project, folder: example.folder },
    })
    if (!result.succeeded) throw new Error(`gate item ${index} failed: ${result.code}`)
    scored.push({ score: result.output.probability, positive: example.positive, holdout: example.holdout })
  }
  return scored
}

export async function measureRelevance(): Promise<ScoredExample[]> {
  const requests = relevanceFixture.map((example) => ({
    message: example.message,
    identity: { vault: "global" as const, id: "fixture", revision: "r" },
    candidate: example.candidate,
  }))
  const results = await scoreCandidates(liveLayaContext(), requests)
  const scored: ScoredExample[] = []
  for (const [index, result] of results.entries()) {
    const example = relevanceFixture[index]
    if (!example) throw new Error(`no fixture for result ${index}`)
    if (!result.succeeded) throw new Error(`relevance item ${index} failed: ${result.code}`)
    scored.push({ score: result.output.probability, positive: example.positive, holdout: example.holdout })
  }
  return scored
}
