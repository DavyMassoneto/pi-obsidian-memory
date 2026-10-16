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
