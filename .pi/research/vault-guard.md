# Vault access guard — research (no project files edited)

## 1. pi tool_call hook
- Blocks per call with reason: `ToolCallEventResult { block?, reason?, terminate? }` — node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:1052-1060. Fail-safe: a throwing handler blocks the tool — node_modules/@earendil-works/pi-coding-agent/docs/extensions.md:260.
- Covers nested calls (`ctx.executeTool`) too — extensions.md:148. Input is mutable in place (types.d.ts:1053).
- Built-in tools, pi 1.0.1 and 1.3.0 identical: read, bash, powershell, edit, write, grep, find, ls — node_modules/@earendil-works/pi-coding-agent/dist/core/tools/index.js:19-28; 1.3.0: /c/Users/Administrator/.pi/agent/install/releases/1.3.0/node_modules/@earendil-works/pi-coding-agent/dist/core/tools/index.js:19-28. All have typed ToolCallEvents (types.d.ts:905-933).
- Active default here: read, powershell, edit, write — /c/Users/Administrator/.pi/agent/settings.json (defaultTools). Others can be activated, so guard all 8.
- Other installed extensions' tools: pi-jev-browser (jev_run/actions/extract/state/logs/stream/stop/desktop — npm/pi-jev-browser/index.ts:224-528; a browser/desktop driver, may touch files — NOT inspected), pi-event-monitor (monitor_watch_path at extensions/index.ts:756 — watches paths, may leak names/contents; NOT inspected), pi-subagents (spawns child pi sessions; child-session.js:173), latchkey, universal-modder (git dir, not inspected), pi-anthropic-auth. Unknown tools can only be handled by a deny-by-default list of known-safe names, or inspecting each.
- Unknown tools = custom tool names (CustomToolCallEvent): hook sees only name+input; path-bearing args need per-tool knowledge.
- Subagents: children are separate pi sessions; whether our extension (and its hook) loads there is NOT verified.

## 2. bash / powershell
- pi has NO OS sandbox. security.md: "Pi can read, change, and execute files with the permissions of the account"; "Watching the transcript... do not create a security boundary" — node_modules/@earendil-works/pi-coding-agent/docs/security.md:3,7. Dedicated user account "can narrow permissions" (security.md table).
- pi hooks: `spawnHook(ctx)` can rewrite command/cwd/env; `BashOperations.exec` replaces the process launcher (so one could launch the shell as another user/inside a container) — node_modules/@earendil-works/pi-coding-agent/dist/core/tools/bash.d.ts:30-70. PowerShellOperations = BashOperations — powershell.d.ts:6. Both are options of createBashTool/createPowerShellTool, i.e. we would re-register tools, not hook; user_bash can also supply operations (types.d.ts:1062).
- Isolation methods pi documents (Docker, Docker Sandboxes, OpenShell, Gondolin micro-VM): containerization.md:9-16 — they isolate the whole pi or the built-in tools; Gondolin routes built-in tools only; extension tools stay on host (line 16). All are Linux-centric; vault must then simply not be mounted (strongest). Native Windows pi + powershell tool: windows.md:35.
- Static analysis cannot be complete (variables, globs, junctions, scripts, base64...). Only OS-level enforcement is sound:
  a) Run model shell as a separate low-privilege Windows user with deny ACE on vault folders (icacls /deny). Launch via custom BashOperations.exec (CreateProcessWithLogon/runas). Feasible, moderate cost: credentials, profile, PATH/tool access for that user; pi's own read/write/edit tools run in-process as the main user and stay covered by tool_call hook. Not verified here.
  b) Docker/WSL2 container for shell only, vault unmounted: feasible if Docker/WSL2 present; cost: toolchain/path divergence. Not verified.
  c) AppContainer/restricted token/Windows Sandbox: no pi support; needs native helper. Not verified.
- Note: tool_call hook still useful as a cheap first layer (deny obvious paths, any case/separator) but cannot be the guarantee for shells.

## 3. pi-claude-bridge (@vanillagreen/pi-claude-bridge 4.2.0, /c/Users/Administrator/.pi/agent/npm/node_modules/@vanillagreen/pi-claude-bridge/package.json:3)
- Used as a model provider via Claude Agent SDK `query()`: src/query-options.ts:150-185. Child runs with `permissionMode: "bypassPermissions"` (query-options.ts:~170).
- Normal path: built-ins removed (`tools: []`, disallowedTools Read/Write/Edit/MultiEdit/Glob/Grep/Bash/NotebookEdit/Web*, Agent/Task/Skill...), only pi's tools re-offered via in-process MCP server — src/connectors.ts:19-46. Tool calls return to pi's agent loop and are dispatched by pi (connectors.ts:371-392), so pi's tool_call hook applies.
- GAP (fail-soft): if bridged tools are absent the substitution half is dropped and CC keeps its own Read/Bash/etc. under bypassPermissions — connectors.ts:656-676, query-options.ts builtinIsolationApplied (~line 80). Child then reads vault outside pi's hook.
- Settings: settingSources may be user/project/local (connectors.ts:86-95; README.md:51) — Claude settings files could load; child env = process.env (query-options.ts:~158). The query options are built inside the bridge; our extension cannot inject permissions.deny/--settings (no extension hook found; grep of pi.on in src/index.ts:1727-1762 shows only session events). Our extension could only: set process env vars before bridge reads them (e.g. CLAUDE_BRIDGE_ISOLATED), or write Claude user settings (~/.claude/settings.json) with permissions.deny — modifying user files, not verified.
- Claude Code own sandbox: "On Windows, Claude Code runs commands unsandboxed... run Claude Code inside WSL2" — https://code.claude.com/docs/en/sandboxing (fetched). Permission rules: https://code.claude.com/docs/en/settings, /permissions (not read in detail).

## 4. Conclusion
| Route | Closable? | How | Residual gap |
|---|---|---|---|
| pi read/write/edit/grep/find/ls | Yes | tool_call block; resolve realpath, case-insensitive, junction/symlink-aware | find/grep/ls with root above vault (e.g. grep D:\ ) returns vault content: must also block ancestors/globs or filter |
| bash/powershell, literal paths | Mostly | tool_call string heuristics | trivially bypassed by indirection |
| bash/powershell, indirect | Only at OS level | custom BashOperations.exec as deny-ACE user, or container w/o mount | needs setup/credentials; unverified; else NOT closable |
| Other ext tools (jev, monitor_watch_path, subagents) | Partly | hook by name; block/inspect | not audited |
| Claude Code via bridge, normal path | Yes | pi-dispatched tools hit hook | — |
| Claude Code bridge, fail-soft / settings | No guarantee | none injectable by us | CC built-ins under bypassPermissions; no Windows CC sandbox |
| user ! / Obsidian | Free | user_bash untouched | — |

Verdict: strict requirement "any route" is NOT satisfiable by hook alone; needs OS-level shell confinement plus bridge gap resolution; else stop milestone and report.
