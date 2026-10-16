# Cofre notes

- 2026-10-12: repo is `eol=lf`. On Windows, Python `open(...,"w")` writes CRLF and biome lint then fails the format check. When scripting edits use `newline=''` (or `sed -i 's/\r$//'` afterwards); prefer the Edit tool.
- Biome `noExcessiveLinesPerFile` = 200 lines: split helpers into new files (e.g. `refresh-plan.ts`, `folder-contents.ts`) instead of growing `refresh-folders.ts`.
- Failing-write fixture that works on Windows: `chmod(file, 0o444)` on `index.md` (rename over it fails EPERM); restore `0o666` in `finally`. On POSIX it would not fail.
- NTFS readdir order is case-insensitive: sort before comparing directory listings in tests.
- `refreshFolders(context, folders, shouldContinue)`: `shouldContinue` is required (lint forbids defaults); internal callers pass `alwaysContinue`.
