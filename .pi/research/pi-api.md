# pi extension API research (pi-coding-agent 1.0.1)
Paths: DOC = node_modules/@earendil-works/pi-coding-agent/docs ; T = .../dist/core/extensions/types.d.ts ; SM = dist/core/session-manager.d.ts ; MR = dist/core/model-registry.d.ts
Doc extensions.md only points to types.d.ts for exact types (DOC/extensions.md:88).

## Entry
`export default function (pi: ExtensionAPI)`; factory may be async; don't start processes/watchers in factory, use session_start; clean up idempotently in session_shutdown (DOC/extensions.md:15,56-60). Loaded via jiti (no build step) (:38). Handlers run in registration order (:97).

## 1. registerCommand
- T:1194 `registerCommand(name: string, options: Omit<RegisteredCommand, "name" | "sourceInfo">): void;`
- T:1134-1140 `RegisteredCommand { name; sourceInfo; description?: string; getArgumentCompletions?: (argumentPrefix: string) => AutocompleteItem[] | null | Promise<...>; handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>; }`  (args = raw string after the command name; DOC/extensions.md:25 example)
- T:286 `ExtensionCommandContext extends ExtensionContext` adds waitForIdle(), newSession, fork, navigateTree, switchSession, reload() (T:288-325); command-only because lifecycle use can deadlock (DOC:214-215).
- UI T:72-80: `select(title: string, options: string[], opts?): Promise<string | undefined>`; `confirm(title: string, message: string, opts?): Promise<boolean>`; `input(title: string, placeholder?: string, opts?): Promise<string | undefined>`; `notify(message: string, type?: "info"|"warning"|"error"): void`.
- No-UI detect: T:213-219 `mode: ExtensionMode` (T:215 `"tui" | "rpc" | "json" | "print"`), `hasUI: boolean` ("dialog-capable UI available (true in TUI and RPC)"). DOC:248-251: print/JSON have no UI; guard with `ctx.hasUI`; `ctx.mode==="tui"` for terminal-only UI.

## 2. registerTool
- T:1192 `registerTool<TParams extends TSchema, TDetails, TState>(tool: ToolDefinition<TParams,TDetails,TState>): void;`
- T:439-: ToolDefinition fields: `name: string; label: string; description: string` (for LLM); optional `promptSnippet`, `promptGuidelines: string[]` (appended to system prompt Guidelines while active; custom tools omitted from "Available tools" unless promptSnippet given); `parameters: TParams` (TypeBox; `typebox` is host-provided, DOC/packages.md:~73); `exposure?: "direct"|"model-only"|"codemode"|"deferred"|"hidden"` (default direct = declared to the model, T:~380; DOC/extensions.md:154-160); `executionMode?`.
- `execute(toolCallId: string, params: Static<TParams>, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<TDetails> | undefined, ctx: ExtensionToolContext): Promise<AgentToolResult<TDetails>>;`
- Result (pi-agent-core/dist/types.d.ts:370) `AgentToolResult<T> { content: (TextContent|ImageContent)[]; details: T; structuredContent?; usage?; ...}`. `details` required (use `undefined`) (DOC/extensions.md:135-136).
- Errors: "Throw from execute() to produce a failed tool result. Returning an object does not mark it as an error." (DOC:138). Tool_call handler failure blocks the tool (DOC:260).
- Visible to LLM: name+description+JSON schema declared while active; `defineTool()` helper T:~510 keeps param inference.

## 3. Events (`pi.on(event, handler)`, handler `(event, ctx: ExtensionContext) => R | void | Promise`, T:1145; returns unsubscribe)
- session_start T:553 `{type; reason: "startup"|"reload"|"new"|"resume"|"fork"; previousSessionFile?}` -> no result (T:1152).
- before_agent_start T:699 `{prompt: string; images?; readonly systemPrompt: string; systemPromptOptions}`; result T:1088 `BeforeAgentStartEventResult { message?: Pick<CustomMessage,"customType"|"content"|"display"|"details">; systemPrompt?: string }`. Returning systemPrompt replaces the whole prompt for the run (invalidates cache; DOC:103 prefers mutating systemPromptOptions).
- context T:657 `{messages: AgentMessage[]}` -> `ContextEventResult {messages?: AgentMessage[]}` (T:1045). Transforms per-request messages without persisting (DOC:115).
- input T:873 `{text; images?; source: "interactive"|"rpc"|"extension"; streamingBehavior?}` -> T:885 `{action:"continue"} | {action:"transform"; text; images?} | {action:"handled"}`.
- agent_end T:715 `{messages: AgentMessage[]}` -> none. (Also agent_before_settle: BoundaryResult, can append entries / `continue: true`, T:759-764; agent_settled notify-only.)
- turn_end T:793 `extends BoundaryState {turnIndex; message; toolResults; messageEntryId; toolResultEntryIds}` -> `BoundaryResult {entries?: SessionBoundaryDraft[]; continue?: boolean}` (T:759; drafts = custom | custom_message | context_edit | compaction, T:745).
- session_before_compact T:579 `{preparation; branchEntries: SessionEntry[]; customInstructions?; reason: "manual"|"threshold"|"overflow"; willRetry; signal}` -> T:1100 `{cancel?: boolean; compaction?: CompactionResult}`. Also session_compact (after).
- session_shutdown T:615 `{reason: "quit"|"reload"|"new"|"resume"|"fork"; targetSessionFile?}` -> none.
- tool_call T:947 union by toolName; `input` mutable in place to patch args (no revalidation). Result T:1052 `ToolCallEventResult {block?: boolean; reason?: string; terminate?: boolean}`; example DOC/extensions.md:175 `return { block: true, reason: ... }`. Narrow with `isToolCallEventType("read", event)` (T:1033).
- user_bash T:861 `{command; excludeFromContext: boolean (!! prefix); cwd}` -> T:1063 `{operations: BashOperations} | {result: BashResult}`; undefined passes through; handler failure blocks (DOC:127).
- message_end can replace message (T:1085); tool_result can alter content/isError (T:1072).

## 4. Injecting content
- T:1221 `sendMessage<T>(message: Pick<CustomMessage<T>,"customType"|"content"|"display"|"details">, options?: {triggerTurn?: boolean; deliverAs?: "steer"|"followUp"|"nextTurn"}): void;` Persisted as `custom_message` entry, "stored and sent to the model" (DOC/extensions.md:230). `CustomMessage {role:"custom"; customType; content: string|(Text|Image)[]; display: boolean; details?; timestamp}` (dist/core/messages.d.ts:32). `display` = shown in TUI (renderer via registerMessageRenderer T:1213); content is LLM-visible regardless (converted to user-role text, DOC/message-types.md:~200).
- before_agent_start returning `message` does the same per prompt (T:1088-1090).
- `appendEntry(customType, data)` T:1235: persisted, NOT sent to LLM.
- `sendUserMessage(content, {deliverAs?: "steer"|"followUp"; expandPromptTemplates?})` T:1230 always triggers a turn.
- Cache: appended messages extend the transcript (prefix-safe). Replacing systemPrompt, `context`-hook rewrites, or tool-set changes can break prefix (DOC:103, 186). Not explicitly verified for before_agent_start message position — UNKNOWN.

## 5. History and LLM
- `ctx.sessionManager: ReadonlySessionManager` (SM:178) = Pick of getCwd,getSessionDir,getSessionId,getSessionFile,getLeafId,getLeafEntry,getEntry,getLabel,getBranch,buildContextEntries,buildSessionProjection,getHeader,getEntries,getTree,getSessionName. `getBranch(fromId?): SessionEntry[]` (SM:311), `getEntries(): SessionEntry[]` (SM:334). DOC:233 prefers getBranch (getEntries includes abandoned branches).
- `SessionEntry` (SM:128) = message | thinking_level_change | model_change | usage | compaction | branch_summary | custom | custom_message | context_edit | label | session_info. `SessionMessageEntry {type:"message"; message: AgentMessage}` (SM:23).
- Model: `ctx.model: Model<any> | undefined` (T:222); `ctx.modelRegistry: ModelRegistry` (T:225).
- MR:28-39 `getAll(): Model<Api>[]; getAvailable(): Model<Api>[]; find(provider, modelId): Model<Api>|undefined; getApiKeyAndHeaders(model): Promise<ResolvedRequestAuth>; streamSimple(model, context: Context, options?: ModelsSimpleStreamOptions): AssistantMessageEventStream;` and MR:52 `getApiKeyForProvider(provider): Promise<string|undefined>`. `ResolvedRequestAuth = {ok:true; apiKey?; headers?; baseUrl?; env?} | {ok:false ...}` (MR:6).
- `Context {systemPrompt?: string; messages: Message[]; tools?: Tool[]}` (pi-ai/dist/types.d.ts:532). The returned stream offers `result(): Promise<AssistantMessage>` (pi-ai/dist/utils/event-stream.d.ts:14). DOC/extensions.md:212: "Use ctx.modelRegistry.streamSimple() for provider-neutral nested model calls" (auth resolved at request time). `completeSimple` exists only on model-runtime.d.ts:101, NOT on ModelRegistry.

## 6. Skills in package
DOC/packages.md:51-65: `"pi": {"extensions": ["./src/extension.ts"], "skills": ["./resources/skills"], "prompts": [...], "themes": [...]}`; paths relative to package root; arrays accept globs and exclusions; keyword `pi-package` for the gallery. Without a manifest, conventional dirs `extensions/ skills/ prompts/ themes/` are discovered (:44-53). Peer-depend (`"*"`) on @earendil-works/pi-coding-agent, pi-ai, pi-agent-core, pi-tui, typebox; don't bundle (:73-85).

## 7. Built-in tools (input names; dist/core/tools/*.d.ts)
- read: `path: string; offset?: number; limit?: number` (read.d.ts:7-9)
- write: `path: string; content: string` (write.d.ts:5-6)
- edit: `path: string; edits: {oldText: string; newText: string}[]` (edit.d.ts:6-9)
- bash: `command: string; timeout?: number` (bash.d.ts:7-8); paths only inside the command string
- powershell also exists (T:909 PowerShellToolCallEvent); same shell-command shape, not inspected
- grep: `pattern; path?; glob?; ignoreCase?; literal?; context?; limit?` (grep.d.ts:6-12)
- find: `pattern; path?; limit?` (find.d.ts:9-11)
- ls: `path?: string; limit?: number` (ls.d.ts:6-7)
Event types: T:905-935. Default of optional path (cwd) not verified.

## 8. process.env
Docs do not say. Evidence: the shell env is built per spawn as `{...process.env, PATH...}` (dist/utils/shell.js:115-123 getShellEnv), so setting process.env.X in session_start should reach bash-tool children (inferred, untested). Per-tool env: DOC/environment-variables.md:53-60 createBashTool spawnHook `env: {...ctx.env, CI: "1"}`. User `!` commands: user_bash `operations`.

## Unknowns / not checked
- Cache-prefix behaviour of before_agent_start `message` vs sendMessage (no doc text; see docs/how-pi-works.md, compaction.md, examples/extensions).
- Empirical test of process.env propagation; ModelsSimpleStreamOptions fields (apiKey override) in pi-ai types.
- examples/extensions/*.ts not read.
