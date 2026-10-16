import { stringify } from "yaml"

import { type NoteType, NoteTypeSchema } from "#src/domain/note"
import type { DashboardView, VaultAsset, VaultDashboard } from "./types.ts"

export function renderVaultAssets(): VaultAsset[] {
  return [...NoteTypeSchema.enum.map(renderHandTemplate), { path: "Memory.base", content: stringify(dashboard()) }]
}

function renderHandTemplate(type: NoteType): VaultAsset {
  return {
    path: `_templates/${type}.md`,
    content: [
      "---",
      "id: REPLACE_WITH_NEW_ULID",
      `type: ${type}`,
      'created: "{{date:YYYY-MM-DD}}"',
      'updated: "{{date:YYYY-MM-DD}}"',
      "---",
      "",
      "{{title}}",
      "",
    ].join("\n"),
  }
}

function dashboard(): VaultDashboard {
  return {
    filters: {
      and: [
        'file.ext.lower() == "md"',
        'file.basename.lower() != "index"',
        '!file.path.lower().startsWith("_templates/")',
      ],
    },
    views: [
      view("All notes", ['!file.path.lower().startsWith("archive/")']),
      view("Don't forget", ['!file.path.lower().startsWith("archive/")', "note.dontForget == true"]),
      view("Archive", ['file.path.lower().startsWith("archive/")']),
    ],
  }
}

function view(name: string, filters: string[]): DashboardView {
  return {
    type: "table",
    name,
    filters: { and: filters },
    order: ["file.name", "file.folder", "note.type", "note.dontForget", "note.updated"],
  }
}
