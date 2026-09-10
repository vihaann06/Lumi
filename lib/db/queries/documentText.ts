import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedPdfText } from '@/lib/utils/pdfText'

const EXTRACTED_TEXT_KIND = 'extracted_text_json'

export function extractedTextPath(docId: string) {
  return `extracted/${docId}.json`
}

/**
 * Persists a document's extracted page text as a storage object and records it
 * in document_assets.
 *
 * Source PDF text was previously extracted in the browser on every reader
 * session and thrown away on refresh. Retrieval needs a durable copy, and
 * storing it once at upload also means the reader no longer has to re-parse
 * the file to build AI context.
 */
export async function saveExtractedText(
  supabase: SupabaseClient,
  input: {
    docId: string
    workspaceId: string
    accountId: string
    bucket: string
    extracted: ExtractedPdfText
  }
): Promise<{ ok: boolean; path: string }> {
  const path = extractedTextPath(input.docId)
  const payload = new Blob([JSON.stringify(input.extracted)], {
    type: 'application/json',
  })

  const { error: uploadError } = await supabase.storage
    .from(input.bucket)
    .upload(path, payload, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'application/json',
    })

  if (uploadError) {
    console.error('Failed uploading extracted PDF text', uploadError)
    return { ok: false, path }
  }

  const { error: assetError } = await supabase.from('document_assets').upsert(
    {
      doc_id: input.docId,
      workspace_id: input.workspaceId,
      account_id: input.accountId,
      kind: EXTRACTED_TEXT_KIND,
      bucket: input.bucket,
      path,
    },
    { onConflict: 'doc_id,kind' }
  )

  if (assetError) {
    console.error('Failed recording extracted text asset', assetError)
    return { ok: false, path }
  }

  return { ok: true, path }
}

/**
 * Loads previously extracted text for a document, or null when it was never
 * extracted (uploads predating this pipeline, scans with no text layer, or a
 * failed extraction).
 */
export async function loadExtractedText(
  supabase: SupabaseClient,
  docId: string
): Promise<ExtractedPdfText | null> {
  const { data: asset, error: assetError } = await supabase
    .from('document_assets')
    .select('bucket, path')
    .eq('doc_id', docId)
    .eq('kind', EXTRACTED_TEXT_KIND)
    .maybeSingle()

  if (assetError || !asset?.bucket || !asset?.path) return null

  const { data, error } = await supabase.storage
    .from(asset.bucket)
    .download(asset.path)

  if (error || !data) {
    console.error('Failed downloading extracted PDF text', error)
    return null
  }

  try {
    return JSON.parse(await data.text()) as ExtractedPdfText
  } catch (err) {
    console.error('Extracted PDF text is not valid JSON', err)
    return null
  }
}
