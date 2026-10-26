export const MEMORY_SETUP_COMMAND = "memory-setup"

export const MEMORY_SETUP_DESCRIPTION = "Choose or attach the global memory vault and write the memory config"

export const SETUP_CREATE_OPTION = "Create a new vault"

export const SETUP_ATTACH_OPTION = "Attach an existing folder"

export const SETUP_MODE_TITLE = "Global memory vault"

export const SETUP_VAULT_TITLE = "Vault folder (absolute path)"

export const SETUP_KEEP_VAULT_TITLE = "Vault folder (leave empty to keep the current one)"

export const SETUP_VAULT_PLACEHOLDER = "Absolute folder path"

export const SETUP_OBSERVER_MODEL_TITLE =
  "Chat model for the observer (it summarizes the conversation for compaction; the model in use is the default and Escape keeps the one marked)"

export const SETUP_AGENT_MODEL_TITLE =
  "Chat model for the memory agent (a small model, it searches memory for each message; sorted by price; Escape keeps the current one)"

export const SETUP_NO_MODEL = "No chat model is available. Connect a model in pi, then run /memory-setup again."

export const SETUP_CANCELLED = "Setup cancelled: nothing changed."

export const SETUP_DONE = "Memory is set up. Global vault:"

export const REPAIR_TITLE = "The memory config needs changes"

export const REPAIR_CONFIRM_LINE = "Continue and rewrite it with every key?"

export const REPLACE_LINE = "The file is not valid JSON and will be replaced."
