import type { PdfPage } from './pdfText'

export interface TextChunk {
  chunkIndex: number
  pageStart: number
  pageEnd: number
  content: string
  charCount: number
}

/**
 * Voyage bills and limits by token, but exposing a tokenizer client-side is not
 * worth the weight. English averages ~4 chars/token; 3.2 deliberately
 * over-estimates so a window never overshoots the API's hard ceiling.
 */
const CHARS_PER_TOKEN = 3.2

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export interface ChunkOptions {
  /** Target chunk size in characters. */
  targetChars?: number
  /** A chunk is never emitted below this size unless it ends a document. */
  minChars?: number
}

interface Sentence {
  text: string
  pageNumber: number
}

/**
 * Splits page text into sentence-ish units, keeping each unit's page number so
 * a chunk can report the range of pages it covers.
 *
 * A "sentence" here ends at . ! ? followed by whitespace. Academic PDFs break
 * this constantly (citations, abbreviations, equations), which is fine: the
 * units only need to be small enough to pack accurately, not linguistically
 * correct.
 */
function toSentences(pages: PdfPage[]): Sentence[] {
  const sentences: Sentence[] = []

  for (const page of pages) {
    if (!page.text) continue

    const parts = page.text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)

    for (const text of parts) {
      sentences.push({ text, pageNumber: page.pageNumber })
    }
  }

  return sentences
}

/**
 * Packs page text into chunks of roughly `targetChars`, never splitting a
 * sentence across two chunks and recording the page span each chunk covers.
 *
 * No overlap between chunks: voyage-context-4 embeds each chunk with the
 * surrounding document already in view, which is what overlap would otherwise
 * be compensating for.
 */
export function chunkPages(
  pages: PdfPage[],
  options: ChunkOptions = {}
): TextChunk[] {
  const targetChars = options.targetChars ?? 1200
  const minChars = options.minChars ?? 200

  const sentences = toSentences(pages)
  const chunks: TextChunk[] = []

  let buffer: string[] = []
  let bufferChars = 0
  let pageStart: number | null = null
  let pageEnd: number | null = null

  const flush = () => {
    if (!buffer.length || pageStart === null || pageEnd === null) return
    const content = buffer.join(' ').trim()
    if (!content) {
      buffer = []
      bufferChars = 0
      pageStart = null
      pageEnd = null
      return
    }

    chunks.push({
      chunkIndex: chunks.length,
      pageStart,
      pageEnd,
      content,
      charCount: content.length,
    })

    buffer = []
    bufferChars = 0
    pageStart = null
    pageEnd = null
  }

  for (const sentence of sentences) {
    // A single sentence longer than the target becomes its own chunk rather
    // than being split mid-thought.
    if (sentence.text.length >= targetChars) {
      flush()
      chunks.push({
        chunkIndex: chunks.length,
        pageStart: sentence.pageNumber,
        pageEnd: sentence.pageNumber,
        content: sentence.text,
        charCount: sentence.text.length,
      })
      continue
    }

    if (bufferChars + sentence.text.length > targetChars && bufferChars >= minChars) {
      flush()
    }

    buffer.push(sentence.text)
    bufferChars += sentence.text.length + 1
    if (pageStart === null) pageStart = sentence.pageNumber
    pageEnd = sentence.pageNumber
  }

  flush()
  return chunks
}

export interface ChunkWindow {
  chunks: TextChunk[]
  estimatedTokens: number
}

/**
 * Groups chunks into contextual windows.
 *
 * Voyage caps one inner list at 32K tokens, so a long paper cannot be embedded
 * as a single contextual group. Chunks are packed in document order into
 * windows under `maxTokens`; chunks within a window are contextualized against
 * each other, and context does not carry across a window boundary.
 */
export function groupIntoWindows(
  chunks: TextChunk[],
  maxTokens = 24000
): ChunkWindow[] {
  const windows: ChunkWindow[] = []
  let current: TextChunk[] = []
  let currentTokens = 0

  for (const chunk of chunks) {
    const tokens = estimateTokens(chunk.content)

    if (current.length && currentTokens + tokens > maxTokens) {
      windows.push({ chunks: current, estimatedTokens: currentTokens })
      current = []
      currentTokens = 0
    }

    current.push(chunk)
    currentTokens += tokens
  }

  if (current.length) {
    windows.push({ chunks: current, estimatedTokens: currentTokens })
  }

  return windows
}

export interface RequestBatch {
  windows: ChunkWindow[]
  estimatedTokens: number
  chunkCount: number
}

/**
 * Packs windows into API requests within Voyage's per-request limits:
 * 1,000 inputs, 16K chunks, and 120K tokens. Limits are applied with headroom
 * because token counts here are estimates.
 */
export function batchWindows(
  windows: ChunkWindow[],
  limits: { maxTokens?: number; maxInputs?: number; maxChunks?: number } = {}
): RequestBatch[] {
  const maxTokens = limits.maxTokens ?? 100000
  const maxInputs = limits.maxInputs ?? 1000
  const maxChunks = limits.maxChunks ?? 16000

  const batches: RequestBatch[] = []
  let current: ChunkWindow[] = []
  let tokens = 0
  let chunkCount = 0

  for (const window of windows) {
    const wouldExceed =
      current.length > 0 &&
      (tokens + window.estimatedTokens > maxTokens ||
        current.length + 1 > maxInputs ||
        chunkCount + window.chunks.length > maxChunks)

    if (wouldExceed) {
      batches.push({ windows: current, estimatedTokens: tokens, chunkCount })
      current = []
      tokens = 0
      chunkCount = 0
    }

    current.push(window)
    tokens += window.estimatedTokens
    chunkCount += window.chunks.length
  }

  if (current.length) {
    batches.push({ windows: current, estimatedTokens: tokens, chunkCount })
  }

  return batches
}
