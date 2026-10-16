# nucleo memory

- 2026-xx: Bash heredocs in this tool halve backslashes (even quoted 'EOF') — write files containing `\` with Write/Edit, never `cat <<`.
- Biome forbids `??`, ternary, `=== null`: use `for` + early return, `if (x)`. `match[1]` is string|undefined: use `replace(regex, (_m: string, g: string) => ...)`.
- `isInside`/`comparablePath` (domain/config/paths.ts) already handle case, separators, UNC, folder boundary; reuse via `#src/domain/config`.
- Domain vault-access (milestone 2): `absoluteCandidate` mirrors pi resolveToCwd (@, unicode spaces, /d/ drive paths, ~, file://), then strips `\\?\`; `win32.resolve` keeps the `\\?\` prefix.
- `#test-helpers` barrel imports services: another owner's WIP syntax error fails every domain test that uses helpers (transient; retry). Lint with `npx biome check src/domain tests/domain` when others' files are broken.
- Domain vector/ranking rules live in search-catalog (`planVectorRefresh`, `fuseRankings`, `standardRrfK`), `cosine` in embeddings/vectors.ts, `loaded-memory/` (fitBudget, replacementBlock, invalidatedBlock), `capture/transcript.ts`; limits constants `maxTextChars` (memory-agent), `maxTranscriptItems` (capture).
