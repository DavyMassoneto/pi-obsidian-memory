import { changeFixture } from "./memory-change.ts"

export async function captureFixture() {
  return changeFixture()
}
