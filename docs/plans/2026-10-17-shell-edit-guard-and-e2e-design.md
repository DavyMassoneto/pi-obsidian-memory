# Shell-edit guard and real end-to-end tests: design

Validated with the user on 2026-10-17. Sources: [jev-guide.md](../../.pi/research/jev-guide.md) (TypeSafe skill and
cookbooks), [laya-jev.md](../../.pi/research/laya-jev.md), [vault-guard.md](../../.pi/research/vault-guard.md).

## User decisions

- The shell never edits files. Files are created or changed only with the `edit` and `write` tools.
- Allowed through the shell: deleting, moving and renaming files; lint and formatters; git; npm; test runners.
- Creating a hardlink through the shell is refused.
- Jev decides, always `jev-latest` (no pinned version).
- When Jev cannot answer (no key, network error, invalid answer, request too large: 400 `max_tokens_exceeded`), the
  call is refused with the cause. No time limit and no size limit; Escape cancels.
- The guard applies whenever the extension is loaded, whatever the memory config says. Background subagents load the
  extension; foreground subagents load none and stay unguarded (accepted).
- Accepted as they are: reading a vault through a path the shell builds indirectly, and tools of other extensions.
- Claude Code through pi-claude-bridge is outside this package (removed).

## Guard flow

A second `tool_call` handler, registered after the vault guard, runs before every `bash` and `powershell` call:

1. Find the scripts the command executes: `node`, `tsx`, `ts-node`, `bun`, `deno run`, `python`, `py`,
   `pwsh|powershell -File`, `bash`, `sh`, `./x.sh`, `& .\x.ps1`, preload flags (`-r`, `--import`), commands chained
   with `&&`, `;` or `|`, and `npm|pnpm|yarn run X|test|start` (the script line from `package.json`).
2. Read each script's text from disk. A missing script is sent marked as missing; a script that exists but cannot be
   read refuses the call.
3. Send Jev one request with the state `{command, cwd, scripts: [{path, text}], missing}` and narrow Noul questions,
   each naming the state paths it looks at (TypeSafe skill: one narrow question per judgment, asked together):
   - `redirection`: does `command` write into a file with a redirection or a file-writing cmdlet (`>`, `>>`,
     `Out-File`, `Set-Content`, `Add-Content`, `tee`)?
   - `in_place`: does `command` change a file in place (`sed -i`, `perl -pi`, `-replace` written back)?
   - `inline_code`: does `command` carry inline code (`node -e`, `python -c`, a `-Command` block) that creates or
     writes a file?
   - `script_writes`: does any `scripts[*].text` create or write a file with its own code, rather than only launching
     a linter, formatter, test runner, build, git or a package manager?
   - `copy_download`: does `command` create a file by copying or downloading content (`Copy-Item`, `cp`, `curl -o`,
     `Invoke-WebRequest -OutFile`), other than through git or a package manager?
   - `hardlink`: does `command` create a hardlink (`New-Item -ItemType HardLink`, `mklink /H`, `ln` without `-s`,
     `fsutil hardlink create`)?
4. Any answer at or above that question's measured cutoff refuses the call. The reason, seen by the LLM in the tool
   result, names the question and points to `edit`/`write`. Nothing is asked to the user.

Questions and cutoffs live in one place in the code (TypeSafe skill).

## Cutoff measurement

- Labelled commands in PowerShell and bash, each marked edit or not and with the question that should fire:
  - refuse: `echo x > f`, `Set-Content`, `Out-File`, `Add-Content`, `tee`, `sed -i`, `-replace` written back,
    `node -e` with `writeFileSync`, `python -c` with `open(...,'w')`, `node script.js` and `npm run X` whose script
    writes a file, `Copy-Item`, `curl -o`, `Invoke-WebRequest -OutFile`, hardlink creation;
  - allow: `npm test`, `npx vitest`, `npm run lint`, `biome check --write`, `npm run format`, `tsc`, `git` (commit,
    checkout, apply), `npm install`, `Remove-Item`, `mv`, `Rename-Item`, `Get-Content`, `Select-String`,
    `node script.js` whose script only reads.
- TypeSafe method: split into a fit group and a check group; per question, pick on the fit group the cutoff that
  refuses every positive with the fewest false refusals; report precision and recall per question and for the final
  rule on the check group.
- Live `jev-latest` calls (about 80 requests of 6 questions; cost estimated from the published price, not measured).
- Results, date and the model id that answered go to a document; re-run with `npm run test:model` when `jev-latest`
  changes. If a question does not separate on the check group, stop and report the numbers instead of picking a
  cutoff.

## Tests

- Every test that simulates pi, the LLM, Jev, embeddings or the clock is removed, area by area, only after that
  area's end-to-end test passes.
- `npm test` keeps the pure domain tests and the services tests on a real temporary disk with no model.
- `npm run test:e2e`, required before every commit:
  - the real pi in RPC mode, in a temporary agent folder that uses pi's own login (the same credentials file, never a
    copy); temporary vaults on disk, never the user's;
  - the conversation is the real Haiku through pi; decisions are the real Jev;
  - the questions of `/memory-setup` and `/memory-init` are answered by the test acting as the user.
- Scenarios, each checked on disk:
  1. the memory tools (`memory_add`, `memory_search`, `memory_get`, `memory_update`, `memory_archive`,
     `memory_succeed`);
  2. `/memory-setup` (first run and settings screen) and `/memory-init`: config, vault and templates;
  3. `/memory-doctor` and `/memory-export`: report text and zip contents;
  4. the Don't forget block and per-message memory;
  5. capture after a turn: what was saved and what was not;
  6. the vault guard: `read` and `bash` on a vault file are refused, and work outside the vaults;
  7. the shell-edit guard: the labelled commands are refused or run, and the disk confirms it;
  8. semantic search with the real local model, finding a paraphrase.
- The AGENTS.md "Tests" section is updated to these decisions.

## To verify before relying on it

- How a temporary agent folder can use pi's login without copying the credentials file.
- How pi's RPC mode drives a prompt and answers extension dialogs.
- The cost and duration of one end-to-end run (measured on the first run).
