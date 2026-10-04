# AGENTS.md

A pi extension that stores the agent's long-term memory in Obsidian vaults. Product and decisions: [docs/VISION.md](docs/VISION.md).

## Layers

pi → usecases → services → domain. Each layer imports only the one right below it (enforced by Biome).

- domain: pure rules, no I/O.
- services: one resource each (vault, index, config, LLM, clock), speaking in domain terms. Paths always arrive as
  parameters; only the pi layer knows the real ones.
- usecases: combine services into one operation; every entry point goes through them.
- pi: events, tools and commands; no logic.
- shared: outside the ladder; every layer may import it, it imports no layer. Only generic result types, no product
  rules.

## Code

- No comments. Make the code explain itself with descriptive names; if something still seems to need a comment, ask
  the user.

## Tests

- Test what can be wrong in a way lint and typecheck can't catch. Pure wiring, types and constants need no test.
  When unsure whether something needs a test, ask the user.
- TDD is mandatory: red (write the test, see it fail), green (write the code that makes it pass), refactor (clean up
  with all tests passing). For a bug fix, the failing test reproduces the bug.
- Files and vaults: real disk in a temp folder, never a mocked filesystem. Tests never touch the user's real vaults or
  config.
- Mock only: pi, the LLM, the clock. To mock anything else, ask the user.
- vitest. `tests/` mirrors `src/` (`src/services/vault/save.ts` → `tests/services/vault/save.test.ts`).
- Shared test helpers live in `tests/helpers/` (one file per topic), imported from `#test-helpers`; test files hold
  only tests.

What each layer's tests prove, and how:

- domain: the rule gives the exact output for each input, edge and error cases included. Plain calls, no disk, no
  mocks. Needing a mock means the function is not pure and belongs in another layer.
- services: the resource is used correctly. Assert the final state of the resource (files, content), not only the
  return value. Clock with `vi.setSystemTime`, LLM with `vi.mock`.
- usecases: the flow is right: which services, in which order, and what happens when a step fails. Real services on a
  temp vault; failures come from real conditions (note changed on disk, missing vault, read-only file). Don't re-test
  service details.
- pi: a fake pi proves each tool, event and command reaches the right usecase and translates its input and output.
  One smoke test in the real pi (`npm run test:pi`, outside `npm test`) proves pi loads the extension; run it before
  each release and after updating pi.
