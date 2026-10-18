# AGENTS.md

A pi extension that stores the agent's long-term memory in Obsidian vaults. Product and decisions:
[docs/VISION.md](docs/VISION.md).

Git worktrees always go in `.worktrees/` (ignored by git).

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
- No catch-all types. A type that accepts any shape (a recursive union of every JSON or YAML value, `Record` of
  anything, a generic used only to dodge a type) is `any` under another name, as is passing a library's `any` on.
  Validate external data at the boundary: read only the shape the format allows, refuse the rest as a problem, and
  give the result a type that says exactly that shape.

## Tests

- Test what can be wrong in a way lint and typecheck can't catch. Pure wiring, types and constants need no test.
  When unsure whether something needs a test, ask the user.
- TDD is mandatory: red (write the test, see it fail), green (write the code that makes it pass), refactor (clean up
  with all tests passing). For a bug fix, the failing test reproduces the bug.
- No simulated tests: nothing fakes pi, the LLM, Jev, Laya, embeddings or the clock (no fake contexts, no `vi.fn`,
  `vi.mock` or `vi.spyOn`, no fake timers or system time). The simulated tests that still exist are deleted area by
  area, each only after that area's end-to-end scenario passes, and only the tests that simulate. The remote
  embeddings providers (`openai`, `google`, `http`) get real tests once the source of a real key is decided (see the
  To do in [docs/ROADMAP.md](docs/ROADMAP.md)).
- `npm test` is offline: pure domain tests, and services and usecases tests on a real temporary disk that simulate
  nothing, with no model and no network.
- `npm run test:e2e` is real and runs in CI on windows-latest for every push; a release needs it green. It runs the real
  pi in RPC mode in a temporary agent folder, talking to OmniRoute through `pi-omniroute-sync` (`OMNIROUTE_URL`,
  `OMNIROUTE_API_KEY` and `TYPESAFE_API_KEY` come from the environment), with temporary vaults, `cc/claude-haiku-5-5`
  for the conversation, the real Jev and the real local embeddings model. The test acts as the user and answers the
  dialogs; every result is checked on disk. One scenario loads the package the way the user installs it, which proves
  pi loads the extension. It runs one test file at a time, and only one e2e run at a time. The Laya tests, on a real
  laya-serve on 127.0.0.1, are the separate `e2e-laya` project and run only on request.
- `npm run test:model` runs the live model tests: the shell-edit cutoff measurement and the `checkShellEdit` checks
  against `jev-latest`, Laya, the local embeddings model and the real model download. Run it when asked or when a
  model changes; measured numbers go to `docs/`.
- Files and vaults: real disk in a temp folder. Tests never touch the user's real vaults, config or agent folder.
- vitest. `tests/` mirrors `src/` (`src/services/vault/save.ts` → `tests/services/vault/save.test.ts`); live model
  tests mirror it too and end in `.model.test.ts`. The one exception: end-to-end scenarios live in
  `tests/e2e/<area>.e2e.test.ts`.
- Shared test helpers live in `tests/helpers/` (one file per topic), imported from `#test-helpers`; test files hold
  only tests.

What each kind of test proves, and how:

- domain: the rule gives the exact output for each input, edge and error cases included. Plain calls, no disk.
- services: the resource is used correctly. Assert the final state of the resource (files, content), not only the
  return value, on a real temporary disk. Services that only speak to a model are proven by `test:model` or `test:e2e`.
- usecases: the flow is right, on real services: a real temporary disk in `npm test`, or the live model in
  `test:model`. Failures come from real conditions (no Jev key, unreadable script, invalid config, a note changed on
  disk).
- pi (`tests/e2e`): one scenario per area drives the real pi as the user would and checks what the user and the LLM
  see and what is on disk.

## Roadmap

- Whenever an item is completed, mark it as done in [docs/ROADMAP.md](docs/ROADMAP.md).
