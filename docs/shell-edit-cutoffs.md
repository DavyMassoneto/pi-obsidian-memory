# Shell-edit guard cutoffs (Jev)

Measured 2026-10-17T11:15:03.706Z (UTC) against `jev-latest`. The "Answered by" line of the report: `jev-latest`. The
measurement goes through the guard's own code (`readExecutedScripts` + `askShellEdit`, pi's classifier). The cutoffs
are `SHELL_EDIT_CUTOFFS` in `src/domain/shell-edit/constants.ts`.

Reproduce with `npm run test:model` (or `npx vitest run --project model tests/services/shell-edit/ask.model.test.ts`)
and re-run it whenever `jev-latest` changes.

## Method (TypeSafe)

- 53 labelled commands (`tests/helpers/shell-edit-labels.ts`), each either refused by one named question or allowed.
- The two download labels use the placeholder `http://127.0.0.1:0/page.html`. The measurement swaps the port of a real
  local HTTP server into the command (`withDownloadSource`), so Jev sees the same text the guard sees at runtime. The
  per-command table below shows the labels, with the placeholder.
- Within each label, commands alternate between a fit group and a check group.
- Per question the examples are that question's positives plus every allowed command.
- On the fit group, the cutoff is a grid value (0.05 to 0.95) that refuses every positive with the fewest false
  refusals.
- Ties: the cutoff closest to 0.5 wins; on equal distance, the lower one. Sources: `.pi/research/jev-guide.md:172-173`
  (0.5 is TypeSafe's default when both errors cost) and `.pi/research/jev-guide.md:191-193` (a cutoff placed on a
  cluster of examples will flip some of them, so the lowest tie, at the edge of the allowed cluster, is not used).
- On the check group, a question "separates" when no edit is missed and no allowed command is refused.
- A question that does not separate stops the work; no cutoff is picked.

## Results

Report of 2026-10-17T11:15:03.706Z, 53 commands. Every question has cutoff 0.5.

| question | cutoff | fit P / R | check P / R | check TP / FP / FN | separates |
|---|---|---|---|---|---|
| redirection | 0.5 | 1.00 / 1.00 | 1.00 / 1.00 | 3 / 0 / 0 | true |
| in_place | 0.5 | 1.00 / 1.00 | 1.00 / 1.00 | 2 / 0 / 0 | true |
| inline_code | 0.5 | 1.00 / 1.00 | 1.00 / 1.00 | 2 / 0 / 0 | true |
| script_writes | 0.5 | 1.00 / 1.00 | 1.00 / 1.00 | 2 / 0 / 0 | true |
| copy_download | 0.5 | 1.00 / 1.00 | 1.00 / 1.00 | 2 / 0 / 0 | true |
| hardlink | 0.5 | 1.00 / 1.00 | 1.00 / 1.00 | 2 / 0 / 0 | true |

Fit P / R are computed from the per-command scores below at cutoff 0.5.

Ties on the fit group (all picked as closest to 0.5, lower on equal distance):

| question | tied cutoffs |
|---|---|
| redirection | 16, from 0.2 to 0.95 |
| in_place | 15, from 0.25 to 0.95 |
| inline_code | 18, from 0.1 to 0.95 |
| script_writes | 17, from 0.1 to 0.9 |
| copy_download | 18, from 0.1 to 0.95 |
| hardlink | 17, from 0.1 to 0.9 |

Highest score among allowed commands and lowest score among that question's positives, over all 53 commands:

| question | highest allowed | lowest positive |
|---|---|---|
| redirection | 0.16 `git checkout -- src.txt` | 0.99 (all 7 tie) |
| in_place | 0.42 `git apply fix.patch` | 0.97 (`sed -i`, `perl -pi`, `sed -i.bak` tie) |
| inline_code | 0.06 `npx biome check --write .`, `git apply fix.patch` | 0.99 (all 5 tie) |
| script_writes | 0.09 `npm run format` | 0.93 `npm run gen` (powershell) |
| copy_download | 0.07 `npm install` | 0.98 `cp src.txt copy.txt` |
| hardlink | 0.05 `npm install` | 0.90 `ln src.txt link.txt` |

Final rule on the check group (a command is refused when any question reaches its cutoff):
TP 13, FP 0, FN 0, precision 1.00, recall 1.00.

Cutoffs: `{"redirection":0.5,"in_place":0.5,"inline_code":0.5,"script_writes":0.5,"copy_download":0.5,"hardlink":0.5}`

## Per command

Each entry: shell, expected label, group, then the command and its six scores.

- bash, redirection, fit: `echo x > notes.txt`
  redirection 0.99, in_place 0.68, inline_code 0.34, script_writes 0.07, copy_download 0.03, hardlink 0.02
- bash, redirection, check: `printf 'a\n' >> log.txt`
  redirection 0.99, in_place 0.11, inline_code 0.35, script_writes 0.07, copy_download 0.02, hardlink 0.01
- bash, redirection, fit: `cat src.txt | tee copy.txt`
  redirection 0.99, in_place 0.38, inline_code 0.08, script_writes 0.07, copy_download 0.92, hardlink 0.02
- powershell, redirection, check: `Set-Content -Path notes.txt -Value x`
  redirection 0.99, in_place 0.83, inline_code 0.43, script_writes 0.10, copy_download 0.03, hardlink 0.02
- powershell, redirection, fit: `"x" | Out-File notes.txt`
  redirection 0.99, in_place 0.35, inline_code 0.64, script_writes 0.09, copy_download 0.07, hardlink 0.02
- powershell, redirection, check: `Add-Content -Path log.txt -Value line`
  redirection 0.99, in_place 0.23, inline_code 0.34, script_writes 0.08, copy_download 0.03, hardlink 0.01
- powershell, redirection, fit: `Get-Date > when.txt`
  redirection 0.99, in_place 0.50, inline_code 0.45, script_writes 0.08, copy_download 0.04, hardlink 0.02
- bash, in_place, fit: `sed -i 's/old/new/' src.txt`
  redirection 0.13, in_place 0.97, inline_code 0.17, script_writes 0.08, copy_download 0.02, hardlink 0.01
- bash, in_place, check: `perl -pi -e 's/old/new/' src.txt`
  redirection 0.21, in_place 0.97, inline_code 0.66, script_writes 0.09, copy_download 0.03, hardlink 0.02
- bash, in_place, fit: `sed -i.bak -e 's/a/b/g' config.ini`
  redirection 0.16, in_place 0.97, inline_code 0.23, script_writes 0.08, copy_download 0.35, hardlink 0.02
- powershell, in_place, check: `(Get-Content src.txt) -replace 'old','new' | Set-Content src.txt`
  redirection 0.99, in_place 0.98, inline_code 0.69, script_writes 0.10, copy_download 0.03, hardlink 0.02
- bash, inline_code, fit: `node -e "require('fs').writeFileSync('out.txt','x')"`
  redirection 0.33, in_place 0.51, inline_code 0.99, script_writes 0.10, copy_download 0.02, hardlink 0.02
- bash, inline_code, check: `python -c "open('out.txt','w').write('x')"`
  redirection 0.26, in_place 0.52, inline_code 0.99, script_writes 0.07, copy_download 0.02, hardlink 0.02
- powershell, inline_code, fit: `node -e "require('fs').appendFileSync('log.txt','x')"`
  redirection 0.33, in_place 0.28, inline_code 0.99, script_writes 0.09, copy_download 0.02, hardlink 0.01
- powershell, inline_code, check: `python -c "import pathlib; pathlib.Path('out.txt').write_text('x')"`
  redirection 0.25, in_place 0.54, inline_code 0.99, script_writes 0.10, copy_download 0.02, hardlink 0.02
- powershell, inline_code, fit: `pwsh -Command "[IO.File]::WriteAllText('out.txt','x')"`
  redirection 0.31, in_place 0.58, inline_code 0.99, script_writes 0.11, copy_download 0.02, hardlink 0.02
- bash, script_writes, fit: `node write.js`
  redirection 0.18, in_place 0.28, inline_code 0.06, script_writes 0.96, copy_download 0.02, hardlink 0.02
- bash, script_writes, check: `python write.py`
  redirection 0.14, in_place 0.50, inline_code 0.06, script_writes 0.97, copy_download 0.02, hardlink 0.01
- powershell, script_writes, fit: `node .\write.js`
  redirection 0.18, in_place 0.41, inline_code 0.06, script_writes 0.95, copy_download 0.02, hardlink 0.02
- bash, script_writes, check: `npm run gen`
  redirection 0.29, in_place 0.24, inline_code 0.78, script_writes 0.94, copy_download 0.03, hardlink 0.02
- powershell, script_writes, fit: `npm run gen`
  redirection 0.28, in_place 0.25, inline_code 0.83, script_writes 0.93, copy_download 0.03, hardlink 0.02
- powershell, copy_download, fit: `Copy-Item src.txt copy.txt`
  redirection 0.33, in_place 0.11, inline_code 0.12, script_writes 0.07, copy_download 0.99, hardlink 0.03
- bash, copy_download, check: `cp src.txt copy.txt`
  redirection 0.17, in_place 0.16, inline_code 0.05, script_writes 0.06, copy_download 0.98, hardlink 0.02
- bash, copy_download, fit: `curl -o page.html http://127.0.0.1:0/page.html`
  redirection 0.41, in_place 0.48, inline_code 0.11, script_writes 0.07, copy_download 0.99, hardlink 0.02
- powershell, copy_download, check: `Invoke-WebRequest http://127.0.0.1:0/page.html -OutFile page.html`
  redirection 0.92, in_place 0.49, inline_code 0.32, script_writes 0.09, copy_download 0.99, hardlink 0.02
- powershell, hardlink, fit: `New-Item -ItemType HardLink -Path link.txt -Target src.txt`
  redirection 0.05, in_place 0.03, inline_code 0.29, script_writes 0.08, copy_download 0.03, hardlink 0.98
- powershell, hardlink, check: `cmd /c mklink /H link.txt src.txt`
  redirection 0.05, in_place 0.03, inline_code 0.30, script_writes 0.07, copy_download 0.04, hardlink 0.98
- bash, hardlink, fit: `ln src.txt link.txt`
  redirection 0.06, in_place 0.03, inline_code 0.06, script_writes 0.07, copy_download 0.05, hardlink 0.90
- powershell, hardlink, check: `fsutil hardlink create link.txt src.txt`
  redirection 0.06, in_place 0.03, inline_code 0.11, script_writes 0.07, copy_download 0.03, hardlink 0.97
- bash, allow, fit: `npm test`
  redirection 0.03, in_place 0.04, inline_code 0.04, script_writes 0.05, copy_download 0.04, hardlink 0.03
- powershell, allow, check: `npm test`
  redirection 0.04, in_place 0.04, inline_code 0.03, script_writes 0.06, copy_download 0.04, hardlink 0.03
- bash, allow, fit: `npx vitest run`
  redirection 0.03, in_place 0.03, inline_code 0.03, script_writes 0.06, copy_download 0.04, hardlink 0.02
- bash, allow, check: `npm run lint`
  redirection 0.04, in_place 0.05, inline_code 0.03, script_writes 0.04, copy_download 0.03, hardlink 0.02
- powershell, allow, fit: `npm run format`
  redirection 0.07, in_place 0.15, inline_code 0.05, script_writes 0.09, copy_download 0.03, hardlink 0.03
- bash, allow, check: `npx biome check --write .`
  redirection 0.06, in_place 0.16, inline_code 0.06, script_writes 0.07, copy_download 0.03, hardlink 0.02
- bash, allow, fit: `npx tsc --noEmit`
  redirection 0.03, in_place 0.02, inline_code 0.04, script_writes 0.06, copy_download 0.03, hardlink 0.02
- bash, allow, check: `git commit -m "fix: typo"`
  redirection 0.06, in_place 0.04, inline_code 0.04, script_writes 0.07, copy_download 0.02, hardlink 0.02
- bash, allow, fit: `git checkout -- src.txt`
  redirection 0.16, in_place 0.24, inline_code 0.05, script_writes 0.06, copy_download 0.04, hardlink 0.02
- powershell, allow, check: `git apply fix.patch`
  redirection 0.05, in_place 0.42, inline_code 0.06, script_writes 0.06, copy_download 0.04, hardlink 0.02
- bash, allow, fit: `npm install`
  redirection 0.04, in_place 0.04, inline_code 0.04, script_writes 0.05, copy_download 0.07, hardlink 0.05
- powershell, allow, check: `Remove-Item old.txt`
  redirection 0.04, in_place 0.03, inline_code 0.03, script_writes 0.07, copy_download 0.01, hardlink 0.01
- bash, allow, fit: `rm old.txt`
  redirection 0.03, in_place 0.02, inline_code 0.02, script_writes 0.06, copy_download 0.01, hardlink 0.01
- bash, allow, check: `mv a.txt b.txt`
  redirection 0.04, in_place 0.03, inline_code 0.03, script_writes 0.07, copy_download 0.02, hardlink 0.03
- powershell, allow, fit: `Rename-Item a.txt b.txt`
  redirection 0.04, in_place 0.04, inline_code 0.05, script_writes 0.07, copy_download 0.02, hardlink 0.02
- powershell, allow, check: `Move-Item a.txt archive\a.txt`
  redirection 0.06, in_place 0.03, inline_code 0.05, script_writes 0.06, copy_download 0.03, hardlink 0.02
- powershell, allow, fit: `Get-Content src.txt`
  redirection 0.03, in_place 0.03, inline_code 0.03, script_writes 0.06, copy_download 0.02, hardlink 0.01
- bash, allow, check: `cat src.txt`
  redirection 0.04, in_place 0.03, inline_code 0.03, script_writes 0.07, copy_download 0.02, hardlink 0.01
- powershell, allow, fit: `Select-String -Path src.txt -Pattern old`
  redirection 0.04, in_place 0.03, inline_code 0.03, script_writes 0.06, copy_download 0.02, hardlink 0.01
- bash, allow, check: `grep -n old src.txt`
  redirection 0.03, in_place 0.02, inline_code 0.03, script_writes 0.06, copy_download 0.02, hardlink 0.02
- bash, allow, fit: `node read.js`
  redirection 0.03, in_place 0.03, inline_code 0.03, script_writes 0.06, copy_download 0.02, hardlink 0.02
- powershell, allow, check: `python read.py`
  redirection 0.03, in_place 0.03, inline_code 0.04, script_writes 0.06, copy_download 0.02, hardlink 0.02
- bash, allow, fit: `ls -la`
  redirection 0.03, in_place 0.02, inline_code 0.03, script_writes 0.06, copy_download 0.02, hardlink 0.02
- powershell, allow, check: `Get-ChildItem`
  redirection 0.03, in_place 0.02, inline_code 0.03, script_writes 0.07, copy_download 0.02, hardlink 0.02

## Known limits

- The `in_place` question text excludes the design's allowed tools ("rather than through a linter, formatter, test
  runner, build, git or a package manager"). Two earlier runs, both on 2026-10-17, led to it:
  - first run (09:37 UTC, wording with no exclusion): `npx biome check --write .` scored 0.91;
  - second run (09:41 UTC start, exclusion "other than by running a formatter or linter"): `npx biome check --write .`
    scored 0.21 and `git apply fix.patch` scored 0.88, so `in_place` did not separate.
- Cost was not measured: the run does not record token usage.
- Commands of other extensions' tools, and foreground subagents (which load no extensions), are not guarded.
- A value-taking flag followed by its value as the next word is read wrongly by `executedFiles`
  (`src/domain/shell-edit/executed-files.ts`): the value is taken as the script path for `node --conditions x`,
  `python -X`, `bash -o` and `tsx --tsconfig`, and `npm --prefix app run build` yields no package script.
- `bun run <package script>` is read as a file path, not as a package script.
- `pwsh x.ps1` without `-File` (or `-F`) is not read.
- A file that a package script line runs is not read (design:25): only the script line from `package.json` is sent.
- The effect of script text that tries to steer Jev is unmeasured (`.pi/research/jev-guide.md:250-251`).
