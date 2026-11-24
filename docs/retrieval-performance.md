# Local relevant-memory performance verification

## Shared session lease

[The keeper](../src/pi/memory-session/keeper.ts#L70-L79) gives retrieval a sibling session tied to the main session's
abort signal. [The siblings share the lease queue](../src/usecases/session/state.ts#L26-L46), not their read receipts or
configuration bindings. The [queue](../src/usecases/session/lease.ts#L9-L31) admits one operation at a time in
[FIFO order](../src/usecases/session/lease.ts#L43-L67). It serializes config validation and vault work with local changes,
including a [receipted change](../src/usecases/memory-change/change.ts#L18-L36), and can stop admitting work when the
session is replaced.

[Session config resolution](../src/usecases/resolve-memory/resolve-memory.ts#L10-L22) releases before the
[session load calls the agent](../src/usecases/relevant-memory/session-memory.ts#L19-L37). The
[agent loop](../src/usecases/relevant-memory/agent.ts#L20-L42) awaits the chat model without a lease. It then awaits each
read in the batch separately. [Search](../src/usecases/search-memory/search-memory.ts#L33-L47),
[get](../src/usecases/get-memory/get-memory.ts#L14-L36) and [list](../src/usecases/list-memory/list-memory.ts#L11-L32)
each release in their own `finally`. [Don't-forget loading starts first](../src/pi/memory-block/block.ts#L16-L25), and the
[first turn awaits only that load](../src/pi/memory-block/block.ts#L56-L61) for the system section.

For any one foreground acquisition, this background agent can add at most the remaining work of one in-flight read,
or one full operation if queued ahead. A foreground flow that reacquires can encounter it more than once. This is not
an absolute time bound: [search embeds the query](../src/usecases/search-memory/search-memory.ts#L50-L59) and can
[synchronize the index and embeddings](../src/usecases/synchronize-memory/leased/synchronize.ts#L85-L101) under its
lease. Slow storage or embedding inference can extend a search. There is no wait on a background chat-model reply
through this lease, and no lease architecture change was made.

## Isolated live tests

Each E2E ran on real pi RPC, separately, with temporary agent, project and vault folders. The OmniRoute test settings
and model files contain no key; authenticating RPC children get credentials in their environment. The model test uses
its own temporary models and auth paths and an environment reference for the key.

| `npm run test:e2e -- tests/e2e/<file>` | Files passed | Tests passed |
|---|---:|---:|
| `relevant-session.e2e.test.ts` | 1 | 2 |
| `relevant-memory.e2e.test.ts` | 1 | 2 |
| `memory-block.e2e.test.ts` | 1 | 1 |
| `session-replaced-while-loading.e2e.test.ts` | 1 | 1 |
| `semantic.e2e.test.ts` | 1 | 1 |
| `setup.e2e.test.ts` | 1 | 1 |
| `package.e2e.test.ts` | 1 | 2 |

`npm run test:model -- tests/services/llm/retrieve.model.test.ts`: the first two runs each printed one failed file and
one failed test. First the helper used an auth API unavailable from pi's public entry point. Then the test rejected an
otherwise valid batch because it also included search/list actions. The corrected test executed the full batch against
a temporary vault and checked the returned finish indices against the actual read positions. Two runs then printed one
passing file and one passing test each, using `omniroute/cx/gpt-6.1-terra`. No prompt or validator change was needed.

Final offline checks: `npm test` printed 291 files passed, 2,265 tests passed and 3 skipped; `npm run lint`
checked 1,088 files without errors, and `npm run typecheck` exited successfully.

## Read-only real-vault run

A temporary Node driver called the worktree's usecases with the configured pi model registry, real Jev and local
embeddings. Node filesystem writes were allowed only in the temporary benchmark directory, and the driver checked that
writes were not allowed to the real config, agent folder or configured vault roots. The SQLite index and model-runtime
state were temporary. The driver and its files were removed afterward. The supplied working folder matched no registered
project, so these timings cover the real global vault only. Priming the temporary index and local embedder took
**4.183 s**; warm search reported fused results and no search warnings or semantic problems.

| Operation | Before (reported) | After (measured) | Chat LLM calls | Jev calls |
|---|---:|---:|---:|---:|
| Session load, isolated | 53.8 s / 13 LLM calls | 46.569 s | 10 | 0 |
| Session load, alongside first message | — | 24.708 s | 4 | 0 |
| Per-message gate yes | 54.3 s / 15 LLM calls | 1.961 s | 0 | 6 |
| Per-message gate no | 0.4 s | 0.833 s | 0 | 1 |
| Warm search | 0.2 s | 0.270 s | 0 | 0 |
| First message's memory work, with session load running | — | 2.402 s | 0 | 6 |

The first message spent **0.185 s** loading Don't forget and **2.215 s** on gate-yes retrieval. It was ready while the
session agent's first LLM call was still in flight. The gate used the configured 0.5 cutoff. For
“Quais sao as minhas regras sobre subagentes e testes?” the probability was 0.83 alone and 0.82 alongside session load;
retrieval added two notes in each run. For “ok, pode seguir” it was 0.19 and retrieval added no notes.

| Jev call | Gate yes, isolated | First message | Gate no |
|---|---:|---:|---:|
| Gate | 0.232 s | 0.215 s | 0.177 s |
| Rank 1 | 0.165 s | 0.220 s | — |
| Rank 2 | 0.456 s | 0.231 s | — |
| Rank 3 | 0.245 s | 0.228 s | — |
| Rank 4 | 0.210 s | 0.234 s | — |
| Rank 5 | 0.208 s | 0.463 s | — |

Session load is still slow and variable. The isolated run's six refused finish replies all preceded the accepted
finish; none was refused in the concurrent run. These are two individual runs, not latency bounds or rates.

| LLM call | Isolated session load | Concurrent session load |
|---|---|---|
| 1 | 2.680 s, read batch | 2.569 s, read batch |
| 2 | 10.851 s, read batch | 9.708 s, read batch |
| 3 | 7.172 s, read batch | 8.201 s, read batch |
| 4 | 2.560 s, finish refused | 2.525 s, finish accepted |
| 5 | 2.791 s, finish refused | — |
| 6 | 4.752 s, finish refused | — |
| 7 | 5.773 s, finish refused | — |
| 8 | 3.328 s, finish refused | — |
| 9 | 2.511 s, finish refused | — |
| 10 | 2.493 s, finish accepted | — |

Across the two runs, the background lease held for 0.024–0.025 s for config resolution, 0.025–0.031 s per get,
0.027–0.030 s per list, and 0.210–0.236 s per search. The first message's acquisition wait overlapped a held background
lease for **0.024 s**. Its longest individual acquisition waited **0.399 s**; that figure includes queueing behind its
own foreground reads. Cold-search contention, real-project-vault performance and CI results were not verified here.
