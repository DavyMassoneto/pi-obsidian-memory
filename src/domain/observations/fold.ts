import type { Observation, ObservationCommit } from "./types.ts"

export function foldObservations(commits: ObservationCommit[], consolidatedIds: string[]): Observation[] {
  const consolidated = new Set(consolidatedIds)
  const observations = new Map<string, Observation>()
  for (const commit of commits) {
    for (const observation of commit.observations) {
      if (consolidated.has(observation.id) || observations.has(observation.id)) continue
      observations.set(observation.id, observation)
    }
  }
  return [...observations.values()]
}
