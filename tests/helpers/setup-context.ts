import { fakePiContext, type PromptScript } from "./pi-context.ts"

export const SETUP_MODEL = { provider: "test-chat", id: "selected-chat" }

export const SETUP_MODEL_LABEL = "test-chat/selected-chat"

export function setupContext(cwd: string, selects: (string | undefined)[], answers: Partial<PromptScript>) {
  return fakePiContext(cwd, {
    available: [SETUP_MODEL],
    answers: { ...answers, selects: [undefined, SETUP_MODEL_LABEL, ...selects] },
  })
}

export function repairContext(cwd: string, selects: (string | undefined)[], answers: Partial<PromptScript>) {
  return fakePiContext(cwd, {
    available: [SETUP_MODEL],
    answers: { ...answers, selects: [undefined, undefined, ...selects] },
  })
}
