import type { Note } from "#/domain"

export function aNote(): Note {
  return {
    statement: "Use pnpm, never npm",
    frontmatter: {
      id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
      type: "rule",
      created: "2026-10-04",
      updated: "2026-10-04",
    },
    body: "Use pnpm for every install and script.",
  }
}
