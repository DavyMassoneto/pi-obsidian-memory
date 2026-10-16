# Revisor memory

- 2026-xx (milestone 0 review): verify "moved, not lost" tests by extracting `^-` lines of `git diff -- tests`
  and `grep -F` each in the untracked/new test files; count `^\s*(test|it)(\.each)?\(` at HEAD vs now.
- Mirror check: for each src/**/*.ts except index/types/constants/schemas/errors/styles, expect tests/<same>.test.ts;
  reverse check lists orphan split files (e.g. *-exact.test.ts, refresh-folders-failures.test.ts) — pre-existing.
- Full `npm test` ~60 s on Windows; lint+typecheck fast. Other agents may edit .pi/skills concurrently: don't attribute.
- AGENTS.md "test files hold only tests": local helper functions in *.test.ts (e.g. keepGoing) are a rule violation.
- 2026-xx (M1 review): real ~/.pi/agent/pi-obsidian-memory/config.json EXISTS on this machine, so dropping
  PI_CODING_AGENT_DIR from tests/helpers/pi.ts loadIsolatedPi makes the smoke test fail (isolation is proven).
  Mutation recipe: cp file tmp/revisor-x.bak; sed; npx vitest run --project unit <dir>; cp back; untracked files
  don't show in git diff, verify restore with grep. tmp/ is NOT gitignored: delete scratch logs.
- 2026-xx (folder-index dirty check): ACL-deny tests (denySynchronizationRead) SKIP on this machine (Administrator
  reads despite ACL) -> any behaviour proven only by them is unproven here; mutate and check. Find src-dead exports
  after refactors with `git grep -n <fn> HEAD -- src` vs now. Mutation via sed on a .bak copy kept outside tmp/.
- 2026-10 (folder-index re-review): Windows byte-range lock helper `whileLocked` (tests/helpers) makes reads fail for
  real on this machine (unlike ACL deny) -> use it to prove "re-rendered vs skipped". registration/flow.test.ts
  failed 2 of 3 full runs, passes alone: flaky under load, not tied to sync changes.
- 2026-10 (M2 review): mutation helper pattern that worked: script `f sedexpr testdir` -> cp to tmp/revisor-<base>.bak,
  sed -i, `npx vitest run --project unit <dir> | grep -E "Tests +[0-9]|×"`, cp back; verify with grep -c + same
  `git diff --stat`. pi-coding-agent dist installs NO process unhandledRejection handler (grep) -> detached promises in
  src/pi (e.g. MemoryBlock #text) can crash pi. Find helper fns in tests: grep `^(async )?function` in *.test.ts.
- 2026-10 (vault-guard review): Bash tool collapses `\` to `\` even inside quoted heredoc -> in probe scripts build
  backslashes with String.fromCharCode(92). Node 22 runs tmp/*.ts with #src imports directly (`node tmp/x.ts`).
  Verified bypass classes for path guards on Windows: `\.\C:\...` and `\localhost\C$\...` are read by Node fs;
  trailing dot/space dirs are NOT (Node namespaces paths -> ENOENT). Guard reads config each call: check config writability.
- 2026-10 (vault-guard re-review): more Windows path-guard bypass classes Node fs reads: `\?\Volume{guid}\...`
  (`mountvol C: /L` gives the GUID) and `\<hostname>\C$`, `\[::1]\C$`. /tmp logs persist across runs: check the
  "Start at" time before trusting a background test log.
- 2026-10 (M3 review): mutation script pattern `tmp/revisor-mut.sh f sedexpr testdirs...` (cp .bak, sed, vitest, restore, rm .bak)
  ran 12 mutations in one Bash call (~10 min budget). Check new *.test.ts for `^async function` (readyNote fixtures
  recur) and new src folders (memory-change, change-report) for missing mirrored tests. Full npm test ~2-3 min now.
- 2026-10 (M7/M8 review): Windows System32 tar.exe (bsdtar 3.8.8, ACP 1252) extracts UTF-8-flagged zip names only
  if representable in cp1252 ("Ação" ok, "✓"/"メモ" fail "empty or unreadable filename"); Expand-Archive handles all
  -> tar.exe is not an oracle for non-Latin names. Mention guard (tests/helpers/pi.ts mentionsIn) misses backticked
  slash commands (`/memory-x`): mutate SKILL.md to prove coverage. complete-blank hash check is doubled by
  update-file.ts expectedHash, so mutating one survives (not a gap).
- 2026-10 (M5 semantic review): fake embedder (tests/helpers/semantic-memory.ts) returns 5 dims for every provider ->
  dimension-mismatch paths (cosine throws RangeError) are invisible to tests; mutate guards in src/usecases/semantic
  (rank.ts fingerprint check, refresh-vectors OTHER_PROVIDER) to check coverage. Mutation script kept in /tmp/revisor/mut.sh
  (cp .bak, sed, vitest grep "Tests|×", restore). pi ModelRegistry.getApiKeyForProvider catches and returns undefined.
- 2026-10 (M4 capture review): write-safety of capture/main-LLM changes rests on SESSION receipts (shared by capture's
  getMemory sourceCallId "capture" and memory_get), not on the action's expectedHash -> probe: edit file + another
  getMemory between capture's get and update overwrites the edit. Probe tests: temp tests/<dir>/revisor-probe.test.ts
  writing results to tmp/ (console.log is swallowed by grep), delete after. ui.input accepts {signal,timeout}.
- 2026-10 (M4 re-review): pi ctx getters (cwd, ui, hasUI, sessionManager...) throw after session replacement/reload
  (runner.assertActive); pi awaits session_shutdown handlers (no timeout) BEFORE invalidate, so work awaited there is
  safe. When using sed line addresses in mutations, get line numbers from `grep -n` on the file, not concatenated cat -n.
