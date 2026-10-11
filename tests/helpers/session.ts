import type { DeliveredRead, SessionIdentity } from "#/usecases"

export function sessionIdentity(): SessionIdentity {
  return { sessionId: "session-one", branchId: "branch-one" }
}

export function deliveredRead(): DeliveredRead {
  return {
    vault: "global",
    path: "Rules/Keep Case.MD",
    canonicalVault: "D:/Memory",
    canonicalPath: "Rules/Keep Case.MD",
    id: "01JABCDE7XKQ2M9V3RTN8WPZ5F00",
    rawHash: "raw-hash-one",
    sourceCallId: "get-one",
    text: "---\ntype: rule\n---\n\nComplete body\n",
    stat: { size: 40, mtimeMs: 1, ctimeMs: 2, device: 3, inode: 4 },
    archived: false,
    analysis: {
      status: "parsed",
      parsed: { statement: "Keep Case", frontmatter: "type: rule", body: "Complete body" },
      frontmatter: {
        id: "01JABCDE7XKQ2M9V3RTN8WPZ5F00",
        type: "rule",
        created: "2026-10-04",
        updated: "2026-10-05",
        dontForget: true,
        replaces: "[[archive/Old]]",
      },
      frontmatterProblems: ["diagnostic frontmatter problem"],
      nameProblems: ["diagnostic name problem"],
      bodyProblems: ["diagnostic body problem"],
      searchable: true,
      needsFixing: true,
    },
  }
}

export function deferredSessionStep() {
  return Promise.withResolvers<void>()
}
