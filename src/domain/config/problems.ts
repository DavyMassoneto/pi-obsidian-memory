import { readConfigInspection } from "./inspection.ts"

export function configShapeProblems(text: string): string[] {
  return readConfigInspection(text).shapeProblems
}
