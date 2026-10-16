import type { CandidateContent } from "#src/services"

export type NoteKey =
  | "note1"
  | "note2"
  | "note3"
  | "note4"
  | "note5"
  | "note6"
  | "note7"
  | "note8"
  | "note9"
  | "note10"
  | "note11"
  | "note12"
  | "note13"
  | "note14"
  | "note15"
  | "note16"
  | "note17"
  | "note18"
  | "note19"
  | "note20"
  | "note21"
  | "note22"
  | "note23"
  | "note24"
  | "note25"
  | "note26"
  | "note27"
  | "note28"
  | "note29"
  | "note30"

export const notes: Record<NoteKey, CandidateContent> = {
  note1: {
    statement: "Project uses pnpm",
    body: "All installs and scripts run through pnpm; npm and yarn lockfiles are rejected in CI.",
  },
  note2: {
    statement: "User prefers Vitest",
    body: "The user prefers Vitest over Jest, with tests next to the source and watch mode off in CI.",
  },
  note3: {
    statement: "Commit message format",
    body: "Conventional commits in English: type(scope): imperative summary under 72 characters.",
  },
  note4: {
    statement: "Orders live in PostgreSQL",
    body: "Orders use PostgreSQL 16 because of transactional guarantees; MongoDB was rejected after the spike.",
  },
  note5: {
    statement: "Deploy runs on Fly.io",
    body: "Deploys go to Fly.io from the main branch through GitHub Actions, with a manual approval step.",
  },
  note6: {
    statement: "React component style",
    body: "Function components only, named exports, props typed with an interface, no default exports.",
  },
  note7: {
    statement: "Language preference",
    body: "The user wants answers in Brazilian Portuguese, keeping code identifiers and commit messages in English.",
  },
  note8: {
    statement: "Retry policy",
    body: "Payments retry three times with exponential backoff starting at 200 ms, only on 5xx and timeouts.",
  },
  note9: {
    statement: "Phase two deadline",
    body: "The client expects phase two delivered by the end of November, with a demo in the second week.",
  },
  note10: {
    statement: "Dietary restrictions",
    body: "The user is lactose intolerant and avoids shellfish; eggs and gluten are fine.",
  },
  note11: {
    statement: "Hotel preferences",
    body: "Prefers quiet rooms on a high floor, breakfast included, and walking distance to public transport.",
  },
  note12: {
    statement: "Knee injury",
    body: "Left knee ligament injury in March: avoid jumping and deep squats, swimming and cycling are fine.",
  },
  note13: {
    statement: "Editor setup",
    body: "Uses Neovim with vim keybindings everywhere, including the shell and the browser.",
  },
  note14: {
    statement: "Meeting time zone",
    body: "Schedules meetings in America/Sao_Paulo and avoids anything before 9:00 local time.",
  },
  note15: {
    statement: "API route naming",
    body: "Routes are plural kebab-case nouns, such as /order-items, with the version prefix /v2.",
  },
  note16: {
    statement: "User's cat is allergic to chicken",
    body: "The cat, Mochi, gets rashes from chicken-based food; the vet recommended the fish formula.",
  },
  note17: {
    statement: "Favorite hiking trail",
    body: "The user's favorite trail is the Pedra Bonita loop, best in the early morning.",
  },
  note18: {
    statement: "Laptop budget",
    body: "Budget for the new laptop is 7,000 BRL, with a preference for 32 GB of RAM over a faster CPU.",
  },
  note19: {
    statement: "Database migration status",
    body: "Migration to the new schema is halfway: tables users and orders are moved, invoices still pending.",
  },
  note20: {
    statement: "Disabled lint rules",
    body: "no-explicit-any is off in tests only; import/order is off because the formatter already sorts imports.",
  },
  note21: {
    statement: "Tone with manager",
    body: "Direct and brief, first name only, one clear ask per email, no exclamation marks.",
  },
  note22: {
    statement: "Meeting room setup",
    body: "Prefers the small room with a whiteboard, camera off for one-on-ones and a standing desk.",
  },
  note23: {
    statement: "Project targets Node 20",
    body: "CI and production run Node 20 LTS; the local .nvmrc pins the same version.",
  },
  note24: {
    statement: "CI pipeline",
    body: "CI runs lint, typecheck and unit tests on every pull request, with deploys only from main.",
  },
  note25: { statement: "Database backups", body: "Nightly backups run at 03:00 UTC and are kept for 14 days." },
  note26: {
    statement: "Staging environment",
    body: "Staging lives at staging.shop.example and is reset every Monday morning.",
  },
  note27: {
    statement: "Backend language",
    body: "The backend is written in Go; the React frontend only consumes its JSON API.",
  },
  note28: {
    statement: "Payments provider",
    body: "Payments go through Stripe; webhooks are verified with the signing secret from the dashboard.",
  },
  note29: {
    statement: "Weekly schedule",
    body: "Works out on Tuesday and Thursday mornings, before the first meeting of the day.",
  },
  note30: {
    statement: "Favorite restaurant",
    body: "Favorite restaurant is a small Japanese place near the office, usually visited on Fridays.",
  },
}
