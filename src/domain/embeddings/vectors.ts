export function normalizeVector(values: readonly number[], dimensions: number): number[] | null {
  if (values.length !== dimensions || dimensions < 1 || values.some((value) => !Number.isFinite(value))) {
    return null
  }

  const scale = values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0)
  if (scale === 0) {
    return null
  }

  const scaled = values.map((value) => value / scale)
  const norm = Math.sqrt(scaled.reduce((sum, value) => sum + value * value, 0))
  return scaled.map((value) => value / norm)
}

export function aggregateVectors(vectors: readonly (readonly number[])[], dimensions: number): number[] | null {
  if (vectors.length === 0) {
    return null
  }

  const sum = Array<number>(dimensions).fill(0)
  for (const values of vectors) {
    const vector = normalizeVector(values, dimensions)
    if (!vector) {
      return null
    }
    for (const [index, value] of vector.entries()) {
      const previous = sum[index]
      if (typeof previous !== "number") {
        return null
      }
      sum[index] = previous + value / vectors.length
    }
  }
  return normalizeVector(sum, dimensions)
}
