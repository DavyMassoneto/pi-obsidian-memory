import { freePort } from "./e2e-laya.ts"

export async function closedLayaEndpoint(): Promise<string> {
  return `http://127.0.0.1:${await freePort()}/v1/systemone`
}
