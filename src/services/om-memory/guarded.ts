import type { GuardedRead, ReadAction } from "./types.ts"

export async function guarded<Output>(path: string, read: ReadAction<Output>): Promise<GuardedRead<Output>> {
  try {
    return { succeeded: true, output: await read() }
  } catch (error) {
    if (error instanceof Error) {
      const code = errorCode(error)
      const problems = [`${path} cannot be read (${code})`]
      if (code === "ENOENT") return { succeeded: false, reason: "not-found", problems }
      return { succeeded: false, reason: "io-error", problems }
    }
    throw error
  }
}

function errorCode(error: Error): string {
  if ("code" in error && typeof error.code === "string") return error.code
  return error.name
}
