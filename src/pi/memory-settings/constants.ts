import type { EmbeddingChoice, WhenChoice } from "./types.ts"

export const CURRENT_MARK = "(current)"

export const IN_USE_MARK = "(in use)"

export const PRICE_SEPARATOR = " · "

export const PRICE_DECIMALS = 4

export const DISCLOSURE_TITLE = "Before setup: what leaves this machine"

export const CHAT_MODELS_DISCLOSURE =
  "Capture and the memory agent send conversation and note content to the chat model you chose."

export const JEV_DISCLOSURE = "TypeSafe (Jev) receives your messages and candidate notes."

export const REMOTE_EMBEDDINGS_DISCLOSURE =
  "The remote embeddings provider receives note content, secrets included, and search queries."

export const SETTINGS_TITLE = "Memory settings (Done or Escape leaves)"

export const DONE_LABEL = "Done"

export const SAVED = "Saved:"

export const RELOAD_NOTE =
  "The Don't forget notes already loaded into this conversation's memory block update at the next session or /reload."

export const CAPTURE_MODEL_TITLE =
  "Chat model for automatic capture (a cheap model is usually enough; Escape keeps the current one)"

export const AGENT_MODEL_TITLE =
  "Chat model for the memory agent (it searches memory for each message; Escape keeps the current one)"

export const WHEN_TITLE = "When does capture run? (Escape keeps the current one)"

export const DECISION_TITLE = "Decision model (Escape keeps the current one)"

export const JEV_OPTION = "Jev (TypeSafe, by API)"

export const LAYA_OPTION = "Laya (local)"

export const LAYA_ENDPOINT_TITLE = "Laya endpoint (empty keeps the current one)"

export const LAYA_DEFAULT_ENDPOINT = "http://127.0.0.1:8000/v1/systemone"

export const EMBEDDINGS_TITLE = "Embeddings provider (Escape keeps the current one)"

export const NONE_WORD = "none"

export const NO_PROJECTS_NOTICE = "No project is registered. Run /memory-init in a project folder to register one."

export const PROJECT_TITLE = "Project (Escape goes back)"

export const PROJECT_ACTION_TITLE = "What to do with this project? (Escape goes back)"

export const PROJECT_CHANGE_VAULT = "Change its vault"

export const PROJECT_REMOVE = "Remove it from the memory"

export const PROJECT_VAULT_TITLE = "Project vault (an existing folder; empty keeps the current one)"

export const WHEN_CHOICES: WhenChoice[] = [
  { value: "after-each-turn", label: "after each turn" },
  { value: "on-compaction", label: "on compaction" },
  { value: "at-session-end", label: "at session end" },
]

export const EMBEDDING_CHOICES: EmbeddingChoice[] = [
  {
    value: { provider: "local", model: "Xenova/multilingual-e5-small" },
    label: "local (Xenova/multilingual-e5-small)",
  },
  { value: { provider: "openai", model: "text-embedding-3-small" }, label: "openai (text-embedding-3-small)" },
  { value: { provider: "google", model: "gemini-embedding-001" }, label: "google (gemini-embedding-001)" },
]
