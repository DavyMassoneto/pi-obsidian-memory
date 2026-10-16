import { join } from "node:path"

import { createLocalEmbedder } from "#src/services"

export const benchmarkNotes: string[] = [
  "Prefer tabs over spaces. The user wants tab indentation in all TypeScript files, width 2 in the editor.",
  "Use pnpm, not npm. All projects use pnpm workspaces; never generate package-lock.json.",
  "Always write tests first. Follow TDD: red, green, refactor. For bugs, the failing test reproduces the bug.",
  "Avoid default exports. Use named exports so imports are greppable and refactors are safe.",
  "No comments in code. Names should explain the code; ask the user if a comment seems needed.",
  "Prefer immutable data. Use readonly arrays and const bindings, copy instead of mutating.",
  "Error handling uses result objects. Functions return {succeeded: false, status} rather than throwing across layers.",
  "Format with Biome. Lint and formatting run through Biome, not ESLint or Prettier.",
  "Database is SQLite. The index lives in a single SQLite file using node:sqlite with WAL mode.",
  "Backend is deployed on Fly.io. The staging app is called acme-api-staging and runs in the Frankfurt region.",
  "The production Postgres database is hosted on Neon. Connection pooling is handled by PgBouncer.",
  "CI runs on GitHub Actions. The pipeline takes about eight minutes and caches the pnpm store.",
  "The team standup is at 9:30 every weekday. Mondays also have a planning session at 10:00.",
  "The mobile app is built with React Native and Expo. Releases go through EAS Build.",
  "Decision: we chose Vitest over Jest because of native ESM support and faster startup.",
  "Decision: embeddings run locally with a quantized multilingual E5 model to keep notes private and offline.",
  "Decision: notes are stored as Markdown files in an Obsidian vault; the index is only a rebuildable cache.",
  "Decision: use ULIDs for note identifiers so they sort by creation time.",
  "Lesson: mocking the filesystem hid a real bug with Windows path separators. Use a real temp folder instead.",
  "Lesson: a migration that locked the users table caused a ten-minute outage. Run big migrations in batches off-peak.",
  "Lesson: the flaky checkout test was caused by a shared clock. Freeze time in tests that depend on dates.",
  "Lesson: forgetting to dispose the model leaked memory in long sessions. Always release native resources on shutdown.",
  "The user's name is Marta and she lives in Lisbon. She prefers to be addressed informally.",
  "Marta drives an old Volvo estate and commutes by bike when the weather is good.",
  "The user is allergic to peanuts and avoids restaurants with open nut bars.",
  "The user's favorite editor is Neovim with the Lazy plugin manager and a Gruvbox theme.",
  "Responses should be short and direct. Skip preambles and avoid repeating the question back.",
  "API rate limit for the payments provider is 100 requests per second; use exponential backoff on 429 responses.",
  "Authentication uses short-lived JWT access tokens of 15 minutes with rotating refresh tokens stored in HttpOnly cookies.",
  "The search feature uses hybrid ranking: keyword matches from FTS5 combined with vector similarity via reciprocal rank fusion.",
  "Logging uses structured JSON lines with a request id. Never log access tokens or email addresses.",
  "The monorepo has three packages: web, api and shared. Shared must not import from web or api.",
  "Docker images are built from node:22-slim and run as a non-root user.",
  "Feature flags are managed in LaunchDarkly; remove a flag within two sprints after full rollout.",
  "Code review: pull requests should stay under 400 changed lines and have at least one approval.",
  "Commit messages follow Conventional Commits, e.g. feat(search): add minimum similarity.",
  "The quarterly goal is to reduce p95 API latency below 200 milliseconds.",
  "Lunch with the design team happens on Thursdays; the usual place is the Vietnamese restaurant near the office.",
  "The user reads Dutch novels in the evening and is learning the language with a weekly tutor.",
  "Backups of the vault are synced to an encrypted external drive every Sunday night.",
  "Use dependency injection through function parameters instead of a container framework.",
]
export const benchmarkQueries = [
  { q: "what indentation style does the user like", rel: [0] },
  { q: "which package manager should I use", rel: [1] },
  { q: "how should I develop new features and fix bugs", rel: [2] },
  { q: "default exports", rel: [3] },
  { q: "should I add explanatory remarks in source files", rel: [4], paraphrase: true },
  { q: "can I modify arrays in place", rel: [5], paraphrase: true },
  { q: "how do functions report failures", rel: [6] },
  { q: "which linter and code formatter", rel: [7] },
  { q: "where is the search index stored", rel: [8] },
  { q: "where is the staging server hosted", rel: [9] },
  { q: "relational database in production", rel: [10, 8] },
  { q: "continuous integration duration", rel: [11] },
  { q: "when is the daily team meeting", rel: [12] },
  { q: "how do we ship the phone application", rel: [13], paraphrase: true },
  { q: "why not Jest", rel: [14] },
  { q: "why is the embedding model on the user's machine", rel: [15] },
  { q: "source of truth for notes", rel: [16] },
  { q: "how are identifiers generated", rel: [17] },
  { q: "problems caused by faking the disk in tests", rel: [18] },
  { q: "what went wrong with database schema changes", rel: [19] },
  { q: "tests that fail randomly", rel: [20], paraphrase: true },
  { q: "memory leak", rel: [21] },
  { q: "what is the user's name and city", rel: [22] },
  { q: "what automobile does Marta own", rel: [23], paraphrase: true },
  { q: "dietary restrictions", rel: [24], paraphrase: true },
  { q: "preferred text editor setup", rel: [25] },
  { q: "how verbose should my answers be", rel: [26], paraphrase: true },
  { q: "throttling of the billing service", rel: [27], paraphrase: true },
  { q: "how do login sessions work", rel: [28] },
  { q: "how does ranking combine lexical and semantic results", rel: [29] },
  { q: "what must not appear in logs", rel: [30] },
  { q: "rules about dependencies between packages", rel: [31] },
  { q: "container image base", rel: [32] },
  { q: "toggles for gradual rollout", rel: [33], paraphrase: true },
  { q: "how big can a pull request be", rel: [34] },
  { q: "format of version control messages", rel: [35], paraphrase: true },
  { q: "performance target this quarter", rel: [36] },
  { q: "who does the user eat with on Thursdays", rel: [37] },
  { q: "what is the capital of Australia", rel: [] },
  { q: "best recipe for chocolate cake", rel: [] },
  { q: "how to train a neural network for image classification", rel: [] },
  { q: "history of the Roman empire", rel: [] },
]

export function benchmarkCacheFolder(): string {
  const base = process.env.LOCALAPPDATA
  if (!base) throw new Error("LOCALAPPDATA is required for the model cache")
  return join(base, "pi-obsidian-memory-bench", "models")
}

export function rankedIndexes(similarities: readonly number[]): number[] {
  return similarities
    .map((similarity, index) => ({ similarity, index }))
    .sort((left, right) => right.similarity - left.similarity || left.index - right.index)
    .map((item) => item.index)
}

const BATCH_SIZE = 20

export async function embedBenchmark() {
  const embedder = createLocalEmbedder({ cachePath: benchmarkCacheFolder(), downloadConsent: true })
  const context = { signal: new AbortController().signal, timeoutMs: 600_000 }
  const embedAll = async (purpose: "query" | "document", texts: string[]) => {
    const vectors: (readonly number[])[] = []
    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const inputs = texts.slice(start, start + BATCH_SIZE).map((text, offset) => ({ key: `k${offset}`, text }))
      const result = await embedder.embed(context, { purpose, inputs })
      if (!result.succeeded) throw new Error(`${purpose} embedding failed: ${result.status}`)
      vectors.push(...result.output.items.map((item) => item.vector))
    }
    return vectors
  }
  try {
    const documents = await embedAll("document", benchmarkNotes)
    const queries = await embedAll(
      "query",
      benchmarkQueries.map((item) => item.q),
    )
    return { documents, queries }
  } finally {
    await embedder.dispose()
  }
}
