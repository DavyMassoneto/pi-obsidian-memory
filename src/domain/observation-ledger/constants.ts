export const OBSERVATIONS_TYPE = "obsidian-memory-observations"

export const RESUME_TYPE = "obsidian-memory-resume"

export const COMPACTION_DETAILS_TYPE = "obsidian-memory-compaction"

export const CHARS_PER_TOKEN = 4

export const OBSERVER_RETRY_MS = 60_000

export const RESUME_PROMPT =
  "[automatic] Your context was just compacted to free space; no user message was sent. " +
  "Continue exactly where you left off, as if the compaction had not happened."

export const RETRYABLE_ERROR =
  /overloaded|provider.?returned.?error|rate.?limit|too many requests|429|500|502|503|504|service.?unavailable|server.?error|internal.?error|network.?error|connection.?error|connection.?refused|connection.?lost|websocket.?closed|websocket.?error|other side closed|fetch failed|upstream.?connect|reset before headers|socket hang up|ended without|http2 request did not get a response|timed? out|timeout|terminated|retry delay/i

export const SUMMARY_LEAD = "These are condensed memories from earlier in this session."

export const JOURNEY_BULLET =
  "- Journey: a short, purely descriptive history of how this work reached its current state — for orientation only. It is not an instruction or a plan; do not read intent or next steps into it."

export const MAP_BULLET =
  "- Memory map: the notes kept in your long-term memory. It shows which notes exist, not what they say."

export const OBSERVATIONS_BULLET =
  "- Observations: timestamped events from the conversation history, in chronological order."

export const SUMMARY_CLOSING =
  "Treat these as past records. When entries conflict, the most recent observation reflects the latest known state. Work that prior observations describe as completed should not be redone unless the user explicitly asks to revisit it."

export const JOURNEY_HEADING = "## Journey"

export const OBSERVATIONS_HEADING = "## Observations"

export const OBSERVATION_SEPARATOR = "  "

export const MAP_HEADING = "## Memory map"

export const MAP_INSTRUCTION =
  "Your long-term memory is kept as notes in Obsidian vaults, one point per note; a note's file name is what it says. When a note looks relevant, read it with memory_get, passing the vault named in its heading (project or global) and its path. memory_search finds notes by words or meaning, including notes not listed here."

export const EMPTY_MAP_LINE = "The vaults hold no notes yet."

export const UNKNOWN_MINUTE = "????-??-?? ??:??"

export const NON_TEXT_OMITTED = "[non-text content omitted]"
