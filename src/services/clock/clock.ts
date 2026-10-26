export function today(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return `${now.getFullYear()}-${month}-${day}`
}

export function nowMs(): number {
  return Date.now()
}

export function localTimestamp(ms: number): string {
  const moment = new Date(ms)
  const month = twoDigits(moment.getMonth() + 1)
  const day = twoDigits(moment.getDate())
  const hours = twoDigits(moment.getHours())
  const minutes = twoDigits(moment.getMinutes())
  const seconds = twoDigits(moment.getSeconds())

  return `${moment.getFullYear()}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0")
}
