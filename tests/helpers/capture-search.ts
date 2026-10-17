import { captureMemory, type MemoryOperationContext } from "#src/usecases"
import { scriptedCompletion, userSays } from "./capture-memory.ts"

export async function capturedSearchPaths(context: MemoryOperationContext): Promise<string[]> {
  let paths: string[] = []
  const complete = scriptedCompletion([
    { action: "search", vault: "global", query: "automobile", limit: 5 },
    (input) => {
      const search = input.observations.findLast((item) => item.kind === "search")
      if (search?.kind === "search") paths = search.candidates.map((candidate) => candidate.path)
      return { action: "finish" }
    },
  ])

  await captureMemory(
    { trigger: "after-each-turn", messages: userSays("I drive an automobile"), explicitSaves: [] },
    context,
    complete,
  )
  return paths
}
