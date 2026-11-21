import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import type { OmSource } from "#src/services"

export async function writeProjectFiles(project: string, files: readonly OmSource[]): Promise<void> {
  for (const file of files) {
    const target = join(project, file.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.text)
  }
}

export const OM_LAYOUT_FILES: readonly OmSource[] = [
  { path: ".memory/beamer-kvm.md", text: "---\nname: beamer\n---\nflat topic\n" },
  { path: ".memory/INDEX.md", text: "flat index" },
  { path: ".memory/notes.txt", text: "not markdown" },
  { path: ".memory/.runs/run.md", text: "dot folder" },
  { path: ".memory/.memory/stray.md", text: "stray nested" },
  { path: ".memory/2026-abc/topic.md", text: "session topic\n" },
  { path: ".memory/2026-abc/JOURNEY.md", text: "session journey\n" },
  { path: ".memory/2026-abc/INDEX.md", text: "session index" },
  { path: ".memory/2026-abc/data.json", text: "{}" },
  { path: ".memory/2026-abc/.runs/x.md", text: "session dot folder" },
  { path: ".memory/2026-abc/deep/z.md", text: "too deep" },
  { path: ".memory/aaa-session/JOURNEY.md", text: "other journey\n" },
]

export const OM_LAYOUT_SOURCES: readonly OmSource[] = [
  { path: ".memory/2026-abc/JOURNEY.md", text: "session journey\n" },
  { path: ".memory/2026-abc/topic.md", text: "session topic\n" },
  { path: ".memory/aaa-session/JOURNEY.md", text: "other journey\n" },
  { path: ".memory/beamer-kvm.md", text: "---\nname: beamer\n---\nflat topic\n" },
]
