export const RELEVANT_INTRO =
  "Relevant long-term memory for this message. This is only part of your memory; use memory_search to find more, and memory_get to read a note in full."

export const SESSION_INTRO =
  "Relevant long-term memory for this work. This is only part of your memory; use memory_search to find more, and memory_get to read a note in full."

export const NO_CHANGES = { loaded: [], forgotten: [] }

export const BLOCK_SEPARATOR = "\n\n"

export const SESSION_QUERY_PREFIX = "Memory relevant to starting work on"

export const NO_PROJECT = "no registered project"

export const ROUTING_MISSING_HELP =
  "the Laya server did not say which model answered (it runs with LAYA_JEV_STRICT); run laya-serve without LAYA_JEV_STRICT and bound to 127.0.0.1 with LAYA_HOST"

export const CUTOFFS_MISSING = "Per-message memory is off: the decision model has no cutoff for"

export const CUTOFFS_HELP = "set it with /memory-setup; nothing was added"

export const COULD_NOT_SCORE = "The decision model could not score"

export const AGENT_FAILED = "The memory agent could not find memory:"

export const DECISION_UNAVAILABLE = "The decision model is unavailable, so no memory was added:"

export const SESSION_LOAD_FAILED = "Relevant notes could not be loaded:"
