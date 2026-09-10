-- Migration: folder-scoped similarity search over document_chunks
--
-- Phase 4 of RAG groundwork.
--
-- security invoker (the default, stated explicitly here because getting it
-- wrong is the whole ballgame): the function runs with the caller's rights, so
-- the RLS policies on document_chunks and documents still apply. A security
-- definer function would bypass them and happily return other accounts' chunks.

create or replace function public.match_document_chunks(
  query_embedding vector(1024),
  p_folder_id uuid,
  match_count int default 8,
  min_similarity float default 0.0,
  exclude_doc_id uuid default null
)
returns table (
  id uuid,
  doc_id uuid,
  doc_title text,
  chunk_index int,
  page_start int,
  page_end int,
  content text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  -- Top-k first so the HNSW index drives the scan, then apply the similarity
  -- floor. Filtering on the distance expression in the same WHERE clause would
  -- push the planner toward a sequential scan.
  select *
  from (
    select
      c.id,
      c.doc_id,
      d.title as doc_title,
      c.chunk_index,
      c.page_start,
      c.page_end,
      c.content,
      1 - (c.embedding <=> query_embedding) as similarity
    from public.document_chunks c
    join public.documents d on d.id = c.doc_id
    where c.folder_id = p_folder_id
      and c.embedding is not null
      and (exclude_doc_id is null or c.doc_id <> exclude_doc_id)
    order by c.embedding <=> query_embedding
    limit match_count
  ) ranked
  where ranked.similarity >= min_similarity;
$$;

grant execute on function public.match_document_chunks(
  vector(1024), uuid, int, float, uuid
) to authenticated;
