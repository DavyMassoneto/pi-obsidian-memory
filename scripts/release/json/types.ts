export interface JsonFile<Data> {
  readonly path: string
  readonly data: Data
  readonly lineEnding: string
}
