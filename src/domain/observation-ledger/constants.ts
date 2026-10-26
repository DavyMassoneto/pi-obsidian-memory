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

export const UNKNOWN_MINUTE = "????-??-?? ??:??"

export const NON_TEXT_OMITTED = "[non-text content omitted]"
