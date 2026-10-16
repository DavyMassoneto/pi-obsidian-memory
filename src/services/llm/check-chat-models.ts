import type { ChatModelAuth, ChatModelCheck, ChatModelPort, ChatModelReference } from "./types.ts"

export function checkChatModels<TModel>(
  references: ChatModelReference[],
  port: ChatModelPort<TModel>,
): Promise<ChatModelCheck[]> {
  return Promise.all(references.map((reference) => checkChatModel(reference, port)))
}

async function checkChatModel<TModel>(
  reference: ChatModelReference,
  port: ChatModelPort<TModel>,
): Promise<ChatModelCheck> {
  const label = `${reference.provider}/${reference.id}`
  const model = port.find(reference.provider, reference.id)
  if (!model) {
    return { model: reference, status: "model-not-found", problem: `Model ${label} is not registered in pi` }
  }

  const auth = await resolveAuth(port, model, label)
  if (!auth.ok) {
    return { model: reference, status: "no-credentials", problem: auth.error }
  }
  return { model: reference, status: "ok" }
}

async function resolveAuth<TModel>(port: ChatModelPort<TModel>, model: TModel, label: string): Promise<ChatModelAuth> {
  try {
    return await port.auth(model)
  } catch (error) {
    return { ok: false, error: `Credentials for ${label} could not be resolved: ${String(error)}` }
  }
}
