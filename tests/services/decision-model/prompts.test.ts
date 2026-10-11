import { describe, expect, it } from "vitest"

import { scoreCandidate } from "#/services"
import { candidateDecisionRequest, decisionServer, layaReply } from "#test-helpers"

describe("Decision prompt state", () => {
  it("scores a candidate independently and keeps stable identity outside model text", async () => {
    const body = layaReply(0.6).replaceAll("needed", "relevant")
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      const result = await scoreCandidate({
        context: { ...server.context, model: "custom-multilingual" },
        request: candidateDecisionRequest,
      })
      expect(result).toMatchObject({
        succeeded: true,
        output: { probability: 0.6, diagnostics: { requestedModel: "custom-multilingual" } },
      })
      const sent = server.requests[0]
      expect(sent).toContain("sample-token")
      expect(sent).not.toContain("stable-note")
      expect(sent).toContain('"model":"custom-multilingual"')
      expect(sent).toContain('"relevant"')
    } finally {
      await server.close()
    }
  })
})
