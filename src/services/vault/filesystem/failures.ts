import type { ReadFailure, WriteFailure } from "./types.ts"

export function readFailure(error: Error, path: string): ReadFailure {
  const code = errorCode(error)
  const problems = [`${path} cannot be read (${code})`]
  switch (code) {
    case "ENOENT":
      return { succeeded: false, reason: "not-found", code, problems }
    case "ENOTDIR":
    case "EISDIR":
      return { succeeded: false, reason: "not-directory", code, problems }
    case "EACCES":
    case "EPERM":
    case "EBUSY":
    case "ELOOP":
      return { succeeded: false, reason: "not-readable", code, problems }
    default:
      throw error
  }
}

export function writeFailure(error: Error, path: string): WriteFailure {
  const code = errorCode(error)
  const problems = [`${path} cannot be written (${code})`]
  switch (code) {
    case "ENOENT":
      return { succeeded: false, reason: "not-found", code, problems }
    case "ENOTDIR":
    case "EISDIR":
      return { succeeded: false, reason: "not-directory", code, problems }
    case "EEXIST":
      return { succeeded: false, reason: "exists", code, problems }
    case "EACCES":
    case "EPERM":
    case "EBUSY":
    case "ENOSPC":
    case "EDQUOT":
    case "EROFS":
    case "ENOTSUP":
    case "EXDEV":
    case "EMLINK":
      return { succeeded: false, reason: "not-writable", code, problems }
    default:
      throw error
  }
}

export function errorCode(error: Error): string {
  if ("code" in error && typeof error.code === "string") return error.code
  return error.name
}
