import { MAX_FAILURE_DETAIL_CHARS } from "./constants.ts"

export function boundedFailureDetail(detail: string): string {
  if (detail.length <= MAX_FAILURE_DETAIL_CHARS) return detail
  const last = detail.charCodeAt(MAX_FAILURE_DETAIL_CHARS - 1)
  if (last >= 0xd800 && last <= 0xdbff) return detail.slice(0, MAX_FAILURE_DETAIL_CHARS - 1)
  return detail.slice(0, MAX_FAILURE_DETAIL_CHARS)
}
