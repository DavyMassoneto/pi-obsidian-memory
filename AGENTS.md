# AGENTS.md

A pi extension that stores the agent's long-term memory in Obsidian vaults. Product and decisions: [VISION.md](VISION.md).

## Layers

pi → usecases → services → domain. Each layer imports only the one right below it (enforced by Biome).

- domain: pure rules, no I/O.
- services: one resource each (vault, index, config, LLM, clock), speaking in domain terms.
- usecases: combine services into one operation; every entry point goes through them.
- pi: events, tools and commands; no logic.

## Tests

- Test what can be wrong in a way lint and typecheck can't catch. Pure wiring, types and constants need no test.
  When unsure whether something needs a test, ask the user.
- TDD is mandatory: red (write the test, see it fail), green (write the code that makes it pass), refactor (clean up
  with all tests passing). For a bug fix, the failing test reproduces the bug.
- Files and vaults: real disk in a temp folder, never a mocked filesystem. Tests never touch the user's real vaults or
  config.
- Mock only: pi, the LLM, the clock. To mock anything else, ask the user.
- vitest. `tests/` mirrors `src/` (`src/vault/archive.ts` → `tests/vault/archive.test.ts`).
