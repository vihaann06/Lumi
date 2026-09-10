const VOYAGE_CONTEXTUALIZED_URL = 'https://api.voyageai.com/v1/contextualizedembeddings'

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || ''

/**
 * Contextualized chunk embeddings: each chunk is embedded with the rest of its
 * inner list in view, which is what keeps a mid-paper paragraph interpretable
 * without stitching context in by hand.
 */
export const VOYAGE_EMBEDDING_MODEL =
  process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-context-4'

/** Must match the vector(1024) column in migration 0011. */
export const VOYAGE_OUTPUT_DIMENSION = 1024

export const isVoyageConfigured = () => Boolean(VOYAGE_API_KEY)

interface ContextualizedResponse {
  data?: Array<{
    index?: number
    data?: Array<{ index?: number; embedding?: number[] }>
  }>
  usage?: { total_tokens?: number }
  detail?: string
  error?: { message?: string }
}

export interface EmbedResult {
  /** One embedding array per input window, in request order. */
  windows: number[][][]
  totalTokens: number
}

/**
 * Embeds groups of chunks. Each inner array is one contextual window; the
 * caller is responsible for keeping windows and batches within Voyage's
 * documented limits (see lib/utils/chunking.ts).
 */
export async function embedChunkWindows(
  windows: string[][],
  inputType: 'document' | 'query' = 'document'
): Promise<EmbedResult> {
  if (!VOYAGE_API_KEY) {
    throw new Error('Voyage API key not configured')
  }
  if (!windows.length) {
    return { windows: [], totalTokens: 0 }
  }

  const response = await fetch(VOYAGE_CONTEXTUALIZED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VOYAGE_EMBEDDING_MODEL,
      inputs: windows,
      input_type: inputType,
      output_dimension: VOYAGE_OUTPUT_DIMENSION,
    }),
  })

  const data = (await response.json().catch(() => ({}))) as ContextualizedResponse

  if (!response.ok) {
    const message =
      data?.error?.message || data?.detail || `Voyage request failed (${response.status})`
    throw new Error(message)
  }

  if (!Array.isArray(data.data)) {
    throw new Error('Unexpected Voyage response format')
  }

  // The API documents results in request order, but each entry also carries an
  // explicit index. Sort by it rather than trusting arrival order, since a
  // misalignment here would silently attach embeddings to the wrong chunks.
  const ordered = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

  const result: number[][][] = ordered.map((window) => {
    const inner = Array.isArray(window.data) ? [...window.data] : []
    inner.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    return inner.map((item) => {
      const embedding = item.embedding
      if (!Array.isArray(embedding) || embedding.length !== VOYAGE_OUTPUT_DIMENSION) {
        throw new Error(
          `Voyage returned an embedding of width ${embedding?.length ?? 0}, expected ${VOYAGE_OUTPUT_DIMENSION}`
        )
      }
      return embedding
    })
  })

  if (result.length !== windows.length) {
    throw new Error(
      `Voyage returned ${result.length} windows for ${windows.length} inputs`
    )
  }

  result.forEach((embeddings, i) => {
    if (embeddings.length !== windows[i].length) {
      throw new Error(
        `Voyage returned ${embeddings.length} embeddings for window ${i} of ${windows[i].length} chunks`
      )
    }
  })

  return { windows: result, totalTokens: data.usage?.total_tokens ?? 0 }
}
