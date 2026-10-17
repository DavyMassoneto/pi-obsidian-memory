import type { Static, TSchema } from "typebox"

import {
  AssistantTextResponseSchema,
  type AvailableModel,
  type CommandEntry,
  CommandsResponseSchema,
  ForkMessagesResponseSchema,
  ModelsResponseSchema,
  recordOf,
  StateResponseSchema,
  StatsResponseSchema,
} from "./e2e-records.ts"
import type { OutgoingCommand, SessionCost } from "./e2e-rpc-types.ts"
import { customTexts, MessagesResponseSchema } from "./e2e-turns.ts"

export abstract class RpcCommands {
  protected abstract send(command: OutgoingCommand): Promise<string>

  async newSession(): Promise<void> {
    await this.send({ type: "new_session" })
  }

  async switchSession(sessionPath: string): Promise<void> {
    await this.send({ type: "switch_session", sessionPath })
  }

  async fork(entryId: string): Promise<void> {
    await this.send({ type: "fork", entryId })
  }

  async sessionFile(): Promise<string> {
    const { sessionFile } = (await this.#ask({ type: "get_state" }, StateResponseSchema)).data
    if (!sessionFile) throw new Error("pi has no session file yet")
    return sessionFile
  }

  async forkEntryIds(): Promise<string[]> {
    const { messages } = (await this.#ask({ type: "get_fork_messages" }, ForkMessagesResponseSchema)).data
    return messages.map((message) => message.entryId)
  }

  async availableModels(): Promise<AvailableModel[]> {
    return (await this.#ask({ type: "get_available_models" }, ModelsResponseSchema)).data.models
  }

  async commands(): Promise<CommandEntry[]> {
    return (await this.#ask({ type: "get_commands" }, CommandsResponseSchema)).data.commands
  }

  async lastAssistantText(): Promise<string | null> {
    return (await this.#ask({ type: "get_last_assistant_text" }, AssistantTextResponseSchema)).data.text
  }

  async customMessages(customType: string): Promise<string[]> {
    const { messages } = (await this.#ask({ type: "get_messages" }, MessagesResponseSchema)).data
    return customTexts(messages, customType)
  }

  async cost(): Promise<SessionCost> {
    const { data } = await this.#ask({ type: "get_session_stats" }, StatsResponseSchema)
    return { cost: data.cost, totalTokens: data.tokens.total }
  }

  async #ask<Schema extends TSchema>(command: OutgoingCommand, schema: Schema): Promise<Static<Schema>> {
    const response = recordOf(schema, await this.send(command))
    if (!response) throw new Error(`${command.type} returned another shape`)
    return response
  }
}
