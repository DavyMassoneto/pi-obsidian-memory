import type { ChildProcessWithoutNullStreams } from "node:child_process"

export type PiRun = (pi: ChildProcessWithoutNullStreams) => Promise<void>
