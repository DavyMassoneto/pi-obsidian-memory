import type { CaptureDraft, CaptureRequest, JourneyRequest, ReadObservation, RetrievalRequest } from "#src/services"

export function journeyRequestOf(overrides: Partial<JourneyRequest>): JourneyRequest {
  return {
    model: { provider: "synthetic", id: "fixed-model" },
    signal: new AbortController().signal,
    thinking: "medium",
    journey: "### 2026-10-26 12:00\nThe work began.",
    material: [
      { label: "0001", text: "User asked for <b>bold</b> output" },
      { label: "0002", text: "completed: wrote src/a.ts" },
    ],
    corrections: [],
    targetTokens: 1000,
    now: "2026-10-26T13:35:07",
    ...overrides,
  }
}

export function captureRequest(): CaptureRequest {
  return {
    kind: "consolidate",
    model: { provider: "synthetic", id: "fixed-model" },
    thinking: "off",
    signal: new AbortController().signal,
    context: { project: null, folder: "workspace" },
    observations: [],
    material: [{ label: "user", text: "Remember my token: secret-123" }],
    explicitSaves: [],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
  }
}

export function retrievalRequest(): RetrievalRequest {
  const { model, signal, context } = captureRequest()
  return { model, signal, context, observations: [], query: "What is my token?" }
}

export function captureInputOf(overrides: Partial<CaptureRequest>) {
  const { context, material, observations, explicitSaves, limits } = { ...captureRequest(), ...overrides }
  return { context, material, observations, explicitSaves, limits }
}

export function retrievalInputOf(overrides: Partial<RetrievalRequest>) {
  const { context, query, observations } = { ...retrievalRequest(), ...overrides }
  return { context, query, observations }
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
