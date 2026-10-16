import { vi } from "vitest"

import type { CaptureDraft, CaptureRequest, CompletionPort, ReadObservation, RetrievalRequest } from "#src/services"

export function captureRequest(): CaptureRequest {
  return {
    model: { provider: "synthetic", id: "fixed-model" },
    signal: new AbortController().signal,
    deadline: Date.now() + 10000,
    round: 1,
    context: { project: null, folder: "workspace" },
    observations: [],
    transcriptDelta: [{ role: "user", text: "Remember my token: secret-123" }],
    explicitSaves: [],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
  }
}

export function retrievalRequest(): RetrievalRequest {
  const { model, signal, deadline, round, context } = captureRequest()
  return { model, signal, deadline, round, context, observations: [], query: "What is my token?" }
}

export function completionPort(text: string) {
  return vi.fn<CompletionPort>().mockResolvedValue({ status: "completed", text })
}

export function pendingCompletion() {
  return vi.fn<CompletionPort>().mockImplementation(() => new Promise(() => {}))
}

export function memoryDraft(): CaptureDraft {
  return { folder: "profile", statement: "Access token", body: "secret-123", type: "fact", dontForget: false }
}

export function readObservation(): ReadObservation {
  return {
    kind: "read",
    vault: "global",
    path: "profile/Access token.md",
    id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
    hash: "a".repeat(64),
    statement: "Access token",
    body: "secret-123",
    type: "fact",
    dontForget: false,
  }
}
