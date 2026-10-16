export function defaultExportName(now: Date): string {
  const date = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("-")
  const time = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("")
  return `memory-export-${date}-${time}.zip`
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}
