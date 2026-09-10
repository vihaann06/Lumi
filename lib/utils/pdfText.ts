'use client'

import { pdfjs } from 'react-pdf'

// Matches the worker configuration in thumbnails.ts. Setting it here too means
// extraction works regardless of which module the caller reached first.
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export interface PdfPage {
  pageNumber: number
  text: string
}

export interface ExtractedPdfText {
  version: 1
  pageCount: number
  extractedAt: string
  pages: PdfPage[]
}

/**
 * Pulls the text of every page out of a PDF.
 *
 * Page boundaries are preserved rather than flattened into one string: the
 * retrieval layer needs a page number for each chunk so a result can be
 * anchored back to a location in the document.
 */
export async function extractPdfPages(
  source: File | Blob | ArrayBuffer
): Promise<PdfPage[]> {
  const buffer =
    source instanceof ArrayBuffer ? source : await source.arrayBuffer()

  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const pages: PdfPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item: any) => (item?.str ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    pages.push({ pageNumber: i, text })
  }

  return pages
}

export async function extractPdfText(
  source: File | Blob | ArrayBuffer
): Promise<ExtractedPdfText> {
  const pages = await extractPdfPages(source)

  return {
    version: 1,
    pageCount: pages.length,
    extractedAt: new Date().toISOString(),
    pages,
  }
}

/**
 * Flattens extracted pages into the `[Page N] ...` form the AI routes already
 * expect as document context.
 */
export function pagesToContextString(pages: PdfPage[]): string {
  return pages
    .map((page) => `[Page ${page.pageNumber}] ${page.text}`)
    .join('\n\n')
    .trim()
}

/** True when a PDF yielded no usable text, e.g. a pure scan with no OCR layer. */
export function isEmptyExtraction(pages: PdfPage[]): boolean {
  return pages.every((page) => !page.text)
}
