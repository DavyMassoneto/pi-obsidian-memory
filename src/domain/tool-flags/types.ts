export interface PowerShellParameters {
  file: string[]
  inline: string[]
  value: string[]
  switches: string[]
  aliases: Map<string, string>
}
