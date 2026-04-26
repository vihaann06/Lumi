'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useRouter, useSearchParams, useParams } from 'next/navigation';

// Hooks
import { usePDFViewer } from '@/hooks/usePDFViewer';
import { useHighlights } from '@/hooks/useHighlights';
import { useReferences } from '@/hooks/useReferences';
import { useFileReferences } from '@/hooks/useFileReferences';

// Services
import { chatWithAI } from '@/lib/services/ai/openaiService';
import { crossSourceWithAI, CROSS_SOURCE_ACTION_LABELS } from '@/lib/services/ai/crossSource';
import { getSupabaseClient } from '@/lib/db/supabaseClient';
import { listSynthesisUsageForReferenceIds } from '@/lib/db/queries/synthesisReferenceLinks';

// Components
import PDFViewer from '../../components/reader/PDFViewer';
import SelectionMenu from '../../components/reader/SelectionMenu';
import ExplanationPanel from '../../components/reader/ExplanationPanel';
import PageHighlights from '../../components/reader/PageHighlights';
import CrossSourceMenu from '../../components/reader/CrossSourceMenu';
import { Sparkles, BookmarkCheck } from 'lucide-react';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function ReaderScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const supabase = getSupabaseClient();
  const folderIdParam = params?.id ?? null;
  const [authUser, setAuthUser] = useState(null);
  // PDF Viewer hook
  const {
    docId,
    docMeta,
    pdfFile,
    numPages,
    pageWidth,
    currentPageInView,
    containerRef,
    pdfContainerRef,
    onDocumentLoadSuccess
  } = usePDFViewer();

  // Highlights hook
  const {
    highlights,
    setHighlights,
    selectedHighlightId,
    addHighlight,
    selectHighlight,
    getSelectedHighlight,
    clearSelectedHighlight,
    updateHighlightChatHistory,
    setHighlightsMap,
    updateHighlight
  } = useHighlights(currentPageInView, pdfContainerRef);

  const hideHeader = (searchParams.get('hideHeader') || '').toLowerCase() === '1' || (searchParams.get('hideHeader') || '').toLowerCase() === 'true';

  // Local state for text selection
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isDeletingHighlight, setIsDeletingHighlight] = useState(false);
  const [fileName, setFileName] = useState('Lumi');
  const [rightPanelWidth, setRightPanelWidth] = useState(360);
  const minRight = 260;
  const maxRight = 640;
  const [zoom, setZoom] = useState(1);
  const [pdfDocumentContext, setPdfDocumentContext] = useState('');
  const pdfContextPromiseRef = useRef(null);
  const isMountedRef = useRef(true);
  const MAX_PDF_CONTEXT_CHARS = 700000;
  const workspaceId = docMeta?.workspaceId;
  const folderId = docMeta?.folderId || folderIdParam;
  const accountId = authUser?.id;

  // Auth state
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  // References: folder-level creation + file-scoped attachment
  const { addReference, references: folderReferences, isLoading: isReferencesLoading } = useReferences(folderId);
  const { attach: attachToFile } = useFileReferences(docId);
  const selectedHighlight = getSelectedHighlight();
  const [activeChatRefs, setActiveChatRefs] = useState([]);
  const [refSavedFlash, setRefSavedFlash] = useState(false);
  const [pendingReferenceFocusId, setPendingReferenceFocusId] = useState(null);
  const [selectedReferenceUsages, setSelectedReferenceUsages] = useState([]);
  const [isLoadingSelectedReferenceUsages, setIsLoadingSelectedReferenceUsages] = useState(false);
  const [crossSourceMenu, setCrossSourceMenu] = useState(null);
  const [selectionDropRects, setSelectionDropRects] = useState([]);

  useEffect(() => {
    let cancelled = false
    const loadSelectedReferenceUsages = async () => {
      if (!supabase || !selectedHighlight || selectedHighlight.aiType !== 'reference' || !selectedHighlight.referenceId) {
        setSelectedReferenceUsages([])
        setIsLoadingSelectedReferenceUsages(false)
        return
      }

      setIsLoadingSelectedReferenceUsages(true)
      try {
        const usage = await Promise.race([
          listSynthesisUsageForReferenceIds(supabase, [selectedHighlight.referenceId]),
          new Promise((resolve) => setTimeout(() => resolve({}), 6000)),
        ])
        const entries = usage?.[selectedHighlight.referenceId]?.syntheses || []
        if (!cancelled && isMountedRef.current) setSelectedReferenceUsages(entries)
      } catch {
        if (!cancelled && isMountedRef.current) setSelectedReferenceUsages([])
      } finally {
        if (!cancelled && isMountedRef.current) setIsLoadingSelectedReferenceUsages(false)
      }
    }
    loadSelectedReferenceUsages()
    return () => {
      cancelled = true
    }
  }, [supabase, selectedHighlight?.id, selectedHighlight?.aiType, selectedHighlight?.referenceId])

  useEffect(() => {
    if (isReferencesLoading) return

    const activeReferenceIds = new Set((folderReferences || []).map((ref) => ref.id))
    const staleReferenceHighlights = []

    Object.entries(highlights || {}).forEach(([pageKey, pageHighlights]) => {
      const pageNum = Number(pageKey)
      ;(pageHighlights || []).forEach((highlight) => {
        const isReferenceHighlight = highlight?.aiType === 'reference'
        const referenceId = highlight?.referenceId
        if (!isReferenceHighlight || !referenceId) return
        if (activeReferenceIds.has(referenceId)) return
        staleReferenceHighlights.push({
          pageNum,
          highlightId: highlight.id,
          annotationId: highlight.annotationId || null,
        })
      })
    })

    if (!staleReferenceHighlights.length) return

    const staleKeySet = new Set(
      staleReferenceHighlights.map((item) => `${item.pageNum}:${item.highlightId}`)
    )

    setHighlights((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((pageKey) => {
        const pageNum = Number(pageKey)
        const pageItems = next[pageNum] || []
        next[pageNum] = pageItems.filter(
          (item) => !staleKeySet.has(`${pageNum}:${item.id}`)
        )
      })
      return next
    })

    if (
      selectedHighlightId &&
      staleKeySet.has(`${selectedHighlightId.pageNum}:${selectedHighlightId.highlightId}`)
    ) {
      clearSelectedHighlight()
      setSelectedText('')
    }

    const annotationIds = staleReferenceHighlights
      .map((item) => item.annotationId)
      .filter(Boolean)
    if (annotationIds.length && supabase) {
      void supabase.from('annotations').delete().in('id', annotationIds)
    }
  }, [
    highlights,
    folderReferences,
    isReferencesLoading,
    selectedHighlightId,
    clearSelectedHighlight,
    supabase,
  ])

  // Load persisted annotations + threads
  useEffect(() => {
    const loadAnnotations = async () => {
      if (!supabase || !docId) return;

      const { data: annotations, error } = await supabase
        .from('annotations')
        .select('*')
        .eq('doc_id', docId);

      if (error || !annotations) return;

      const annotationIds = annotations?.map((a) => a.id) || [];
      let threads = [];
      if (annotationIds.length) {
        const { data: threadRows, error: threadError } = await supabase
          .from('threads')
          .select('id, annotation_id')
          .in('annotation_id', annotationIds);
        if (!threadError && threadRows) {
          threads = threadRows;
        }
      }

      const threadIdByAnnotation = threads.reduce((acc, t) => {
        acc[t.annotation_id] = t.id;
        return acc;
      }, {});

      const threadIds = threads.map((t) => t.id);
      let messages = [];
      if (threadIds.length) {
        const { data: msgRows, error: msgError } = await supabase
          .from('thread_messages')
          .select('id, thread_id, role, content, created_at')
          .in('thread_id', threadIds)
          .order('created_at', { ascending: true });
        if (!msgError && msgRows) {
          messages = msgRows;
        }
      }

      const messagesByThread = threadIds.reduce((acc, id) => {
        acc[id] = [];
        return acc;
      }, {});
      messages.forEach((m) => {
        if (!messagesByThread[m.thread_id]) messagesByThread[m.thread_id] = [];
        messagesByThread[m.thread_id].push({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at).getTime()
        });
      });

      const map = {};
      annotations?.forEach((annotation) => {
        const anchor = annotation.anchor_json || {};
        const storedRects = anchor.rects || [];
        const storedWidth = anchor.pageWidth || null;
        const scale =
          storedWidth && pageWidth ? pageWidth / storedWidth : 1;
        const rects = storedRects.map((r) => ({
          ...r,
          x: r.x * scale,
          y: r.y * scale,
          width: r.width * scale,
          height: r.height * scale
        }));
        const aiType = anchor.aiType ?? null;
        const aiContent = anchor.aiContent ?? null;
        const storedChat = anchor.chatHistory || [];
        const threadId = threadIdByAnnotation[annotation.id];
        const chatHistory = threadId ? messagesByThread[threadId] || storedChat : storedChat;

        const highlight = {
          id: annotation.id,
          annotationId: annotation.id,
          text: annotation.quote,
          rects,
          aiType,
          aiContent: aiContent || chatHistory?.[0]?.content || null,
          chatHistory: chatHistory || [],
          threadId,
          referenceId: anchor.referenceId || null
        };

        if (!map[annotation.page]) map[annotation.page] = [];
        map[annotation.page].push(highlight);
      });

      // Merge server refresh with local in-memory chat state so a late reload
      // does not wipe freshly appended AI messages.
      setHighlights((prev) => {
        const localByAnnotationId = {};
        Object.values(prev || {}).forEach((pageHighlights) => {
          (pageHighlights || []).forEach((h) => {
            const key = h.annotationId || h.id;
            if (key) localByAnnotationId[key] = h;
          });
        });

        const merged = {};
        Object.entries(map).forEach(([pageKey, pageHighlights]) => {
          const pageNum = Number(pageKey);
          merged[pageNum] = (pageHighlights || []).map((serverHighlight) => {
            const local = localByAnnotationId[serverHighlight.annotationId || serverHighlight.id];
            if (!local) return serverHighlight;
            const localChat = local.chatHistory || [];
            const serverChat = serverHighlight.chatHistory || [];
            if (localChat.length > serverChat.length) {
              return {
                ...serverHighlight,
                chatHistory: localChat,
                aiContent: local.aiContent || serverHighlight.aiContent,
                threadId: local.threadId || serverHighlight.threadId,
              };
            }
            return serverHighlight;
          });
        });
        return merged;
      });
    };

    loadAnnotations();
  }, [supabase, docId, setHighlightsMap, pageWidth]);

  const persistHighlight = async (pageNum, highlight) => {
    if (!supabase || !docId || !workspaceId || !folderId || !accountId) return;

    const anchor = {
      rects: highlight.rects || [],
      aiType: highlight.aiType || null,
      aiContent: highlight.aiContent || null,
      chatHistory: highlight.chatHistory || [],
      referenceId: highlight.referenceId || null,
      pageWidth: pageWidth || null
    };

    const { data: inserted, error } = await supabase
      .from('annotations')
      .insert({
        workspace_id: workspaceId,
        folder_id: folderId,
        doc_id: docId,
        account_id: accountId,
        created_by: accountId,
        page: pageNum,
        quote: highlight.text,
        anchor_json: anchor,
        has_thread: highlight.aiType === 'chat' || highlight.aiType === 'explanation'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to persist annotation', error);
      return;
    }

    const annotationId = inserted?.id;
    if (annotationId) {
      updateHighlight(pageNum, highlight.id, { id: annotationId, annotationId });
      if (selectedHighlightId?.highlightId === highlight.id) {
        selectHighlight(pageNum, annotationId);
      }
    }

    let threadId = highlight.threadId;

    if ((highlight.aiType === 'chat' || highlight.aiType === 'explanation') && annotationId) {
      const { data: threadRow, error: threadError } = await supabase
        .from('threads')
        .insert({
          workspace_id: workspaceId,
          folder_id: folderId,
          doc_id: docId,
          annotation_id: annotationId,
          account_id: accountId,
          created_by: accountId,
          kind: 'highlight_chat',
          title: highlight.text?.slice(0, 120) || 'Highlight chat'
        })
        .select('id')
        .single();

      if (!threadError && threadRow?.id) {
        threadId = threadRow.id;
        if (highlight.chatHistory?.length) {
          const rows = highlight.chatHistory.map((msg) => ({
            thread_id: threadId,
            workspace_id: workspaceId,
            account_id: accountId,
            role: msg.role,
            content: msg.content,
            content_json: {},
            citations_json: [],
            created_by: accountId
          }));
          await supabase.from('thread_messages').insert(rows);
        }

        await supabase
          .from('annotations')
          .update({
            has_thread: true,
            anchor_json: { ...anchor, threadId }
          })
          .eq('id', annotationId);
      }
    }

    if (threadId) {
      updateHighlight(pageNum, annotationId || highlight.id, { threadId });
    }

    return { annotationId: annotationId || highlight.id, threadId };
  };

  const ensureThreadForHighlight = async (pageNum, highlight) => {
    if (highlight.threadId) return highlight.threadId;
    const anchor = {
      rects: highlight.rects || [],
      aiType: highlight.aiType || null,
      aiContent: highlight.aiContent || null,
      chatHistory: highlight.chatHistory || []
    };

    const { data: threadRow, error } = await supabase
      .from('threads')
      .insert({
        workspace_id: workspaceId,
        folder_id: folderId,
        doc_id: docId,
        annotation_id: highlight.annotationId,
        account_id: accountId,
        created_by: accountId,
        kind: 'highlight_chat',
        title: highlight.text?.slice(0, 120) || 'Highlight chat'
      })
      .select('id')
      .single();

    if (error || !threadRow?.id) {
      console.error('Failed to create thread for highlight', error);
      return null;
    }

    await supabase
      .from('annotations')
      .update({
        has_thread: true,
        anchor_json: { ...anchor, threadId: threadRow.id }
      })
      .eq('id', highlight.annotationId);

    updateHighlight(pageNum, highlight.id, { threadId: threadRow.id });
    return threadRow.id;
  };

  // Derive file name from query or session storage
  useEffect(() => {
    const fromQuery = searchParams.get('fileName');
    if (fromQuery) {
      setFileName(fromQuery);
      return;
    }
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('pdfFileName') : null;
    if (stored) setFileName(stored);
  }, [searchParams]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const extractFullPdfContext = async () => {
    if (pdfDocumentContext) return pdfDocumentContext;
    if (!pdfFile) return '';
    if (pdfContextPromiseRef.current) return pdfContextPromiseRef.current;

    pdfContextPromiseRef.current = (async () => {
      try {
        const response = await fetch(pdfFile);
        const buffer = await response.arrayBuffer();
        const loadingTask = pdfjs.getDocument({
          data: buffer,
          disableWorker: true,
        });
        const pdfDoc = await loadingTask.promise;
        const pages = [];

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => (item?.str ? item.str : ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          pages.push(`[Page ${i}] ${pageText}`);
        }

        const fullText = pages.join('\n\n').trim();
        if (!fullText) {
          setPdfDocumentContext('');
          return '';
        }

        const boundedText =
          fullText.length > MAX_PDF_CONTEXT_CHARS
            ? `${fullText.slice(0, MAX_PDF_CONTEXT_CHARS)}\n\n[PDF context truncated due to size.]`
            : fullText;

        if (isMountedRef.current) {
          setPdfDocumentContext(boundedText);
        }
        return boundedText;
      } catch (error) {
        console.error('Failed to extract PDF context for AI chat', error);
        return '';
      } finally {
        pdfContextPromiseRef.current = null;
      }
    })();

    return pdfContextPromiseRef.current;
  };

  const focusReferenceHighlight = useCallback((referenceId, fallback = {}) => {
    if (!referenceId) return false;

    for (const [pageKey, pageHighlights] of Object.entries(highlights || {})) {
      const target = (pageHighlights || []).find((h) => h.referenceId === referenceId);
      if (target) {
        const pageNum = Number(pageKey);
        selectHighlight(pageNum, target.id);
        setSelectedText(target.text || '');
        setMenuPosition(null);

        if (pdfContainerRef.current) {
          const pageEl = pdfContainerRef.current.querySelector(`[data-page-number="${pageNum}"]`);
          if (pageEl && typeof pageEl.scrollIntoView === 'function') {
            pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        return true;
      }
    }

    const fallbackPage = Number(fallback.pageNumber || 0);
    const fallbackText = (fallback.selectedText || '').trim();
    if (fallbackPage && fallbackText) {
      const pageHighlights = highlights[fallbackPage] || [];
      const byText = pageHighlights.find(
        (h) => h.aiType === 'reference' && (h.text || '').trim() === fallbackText
      );
      if (byText) {
        selectHighlight(fallbackPage, byText.id);
        setSelectedText(byText.text || '');
        setMenuPosition(null);
        const pageEl = pdfContainerRef.current?.querySelector(`[data-page-number="${fallbackPage}"]`);
        if (pageEl && typeof pageEl.scrollIntoView === 'function') {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return true;
      }
    }

    return false;
  }, [highlights, pdfContainerRef, selectHighlight]);

  useEffect(() => {
    setPdfDocumentContext('');
    pdfContextPromiseRef.current = null;
  }, [docId, pdfFile]);

  useEffect(() => {
    const handleParentMessage = (event) => {
      if (event.data?.type === 'reference:add-to-chat' && event.data.reference?.id) {
        setActiveChatRefs((prev) => {
          if (prev.some((ref) => ref.id === event.data.reference.id)) return prev;
          return [...prev, event.data.reference];
        });
        if (accountId) {
          attachToFile(accountId, event.data.reference.id);
          setRefSavedFlash(true);
          setTimeout(() => setRefSavedFlash(false), 1200);
        }
        return;
      }
      if (event.data?.type === 'reference:navigate' && event.data.referenceId) {
        const targetReferenceId = String(event.data.referenceId);
        const focused = focusReferenceHighlight(targetReferenceId, {
          pageNumber: event.data.pageNumber,
          selectedText: event.data.selectedText,
        });
        if (!focused) {
          setPendingReferenceFocusId(targetReferenceId);
        }
      }
    };

    window.addEventListener('message', handleParentMessage);
    return () => window.removeEventListener('message', handleParentMessage);
  }, [focusReferenceHighlight, accountId, attachToFile]);

  useEffect(() => {
    if (!pendingReferenceFocusId) return;
    const focused = focusReferenceHighlight(pendingReferenceFocusId);
    if (focused) {
      setPendingReferenceFocusId(null);
    }
  }, [pendingReferenceFocusId, highlights, focusReferenceHighlight]);

  const buildSelectionDropRects = useCallback((range) => {
    const container = containerRef.current;
    if (!container || !range) return [];
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    return Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top + scrollTop,
        width: rect.width,
        height: rect.height,
      }));
  }, [containerRef]);

  // Handle text selection
  const handleTextSelection = (e) => {
    if (e.target.closest('.highlight-overlay')) {
      return;
    }
    
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text.length > 0) {
        setSelectedText(text);
        
        const range = selection.getRangeAt(0);
        setSelectedRange(range.cloneRange());
        setSelectionDropRects(buildSelectionDropRects(range));
        
        const container = containerRef.current;
        if (container) {
          const rect = range.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const scrollTop = container.scrollTop;
          
          setMenuPosition({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + scrollTop - 8
          });
        }
      } else {
        setMenuPosition(null);
        setSelectedRange(null);
        setSelectionDropRects([]);
      }
    }, 10);
  };

  // Handle highlight creation
  const handleHighlight = () => {
    if (selectedText && selectedRange) {
      const result = addHighlight(selectedText, selectedRange, currentPageInView);
      if (result?.highlight) {
        persistHighlight(result.pageNum, result.highlight);
      }
      setSelectedText(selectedText);
      setMenuPosition(null);
      setSelectedRange(null);
      setSelectionDropRects([]);
      window.getSelection().removeAllRanges();
    }
  };

  // Handle highlight click
  const onHighlightClick = (pageNum, highlightId) => {
    selectHighlight(pageNum, highlightId);
    setSelectedRange(null);
    setSelectionDropRects([]);
    const highlight = highlights[pageNum]?.find(h => h.id === highlightId);
    if (highlight) {
      setSelectedText(highlight.text);
      setMenuPosition(null);
      
      const isChatHighlight = ['chat', 'explanation'].includes(highlight.aiType);
      const isReferenceHighlight = highlight.aiType === 'reference';
      if ((isChatHighlight || isReferenceHighlight) && isPanelCollapsed) setIsPanelCollapsed(false);

      if (highlight.aiType === 'reference' && highlight.referenceId && typeof window !== 'undefined') {
        window.parent?.postMessage(
          {
            type: 'reference:focus',
            referenceId: highlight.referenceId,
          },
          '*'
        );
      }
    }
  };

  // Handle AI chat action with selected text
  const handleAIChatClick = async () => {
    if (!selectedText || !selectedRange) return;

    const highlightResult = addHighlight(selectedText, selectedRange, currentPageInView, 'chat', null);
    setMenuPosition(null);

    if (highlightResult?.highlight) {
      const persisted = await persistHighlight(highlightResult.pageNum, highlightResult.highlight);
      const resolvedId = persisted?.annotationId || highlightResult.highlight.id;
      selectHighlight(highlightResult.pageNum, resolvedId);
      setSelectedText(highlightResult.highlight.text);
      if (isPanelCollapsed) setIsPanelCollapsed(false);
      // Warm the full-document context after user explicitly enters chat mode.
      extractFullPdfContext();
    }
    setSelectedRange(null);
    setSelectionDropRects([]);
    window.getSelection().removeAllRanges();
  };

  // Handle chat message for chat-enabled highlights
  const handleSendChatMessage = async (message) => {
    if (
      !selectedHighlight ||
      !selectedHighlightId ||
      !['chat', 'explanation'].includes(selectedHighlight.aiType)
    ) return;

    const { pageNum, highlightId } = selectedHighlightId;
    const currentChatHistory = selectedHighlight.chatHistory || [];
    
    // Add user message to chat history
    const updatedChatHistory = [
      ...currentChatHistory,
      {
        role: 'user',
        content: message,
        timestamp: Date.now()
      }
    ];

    // Update highlight with user message
    updateHighlightChatHistory(pageNum, highlightId, updatedChatHistory);

    const effectiveHighlight = {
      ...selectedHighlight,
      annotationId: selectedHighlight.annotationId || selectedHighlight.id,
    };

    let threadId = effectiveHighlight.threadId;
    if (!threadId) {
      threadId = await ensureThreadForHighlight(pageNum, effectiveHighlight);
    }

    if (threadId && supabase && accountId && workspaceId) {
      await supabase.from('thread_messages').insert({
        thread_id: threadId,
        workspace_id: workspaceId,
        account_id: accountId,
        role: 'user',
        content: message,
        content_json: {},
        citations_json: [],
        created_by: accountId
      });
    }

    // Get AI response
    setIsChatLoading(true);
    try {
      const fullDocumentText = await extractFullPdfContext();
      const referenceContext = (activeChatRefs || []).map((ref) => ({
        label: `R${ref.referenceNumber}`,
        sourceDocTitle: ref.sourceDocTitle || 'Untitled source',
        pageNumber: ref.pageNumber || null,
        selectedText: ref.selectedText || ''
      }));
      const aiResponse = await chatWithAI(
        selectedHighlight.text,
        updatedChatHistory,
        message,
        {
          documentTitle: fileName,
          pageNumber: pageNum,
          totalPages: numPages,
          fullDocumentText,
          references: referenceContext
        }
      );
      const citedLabels = new Set();
      const citationRegex = /\[(R\d+)\]/gi;
      let citationMatch = citationRegex.exec(aiResponse);
      while (citationMatch) {
        citedLabels.add(String(citationMatch[1]).toUpperCase());
        citationMatch = citationRegex.exec(aiResponse);
      }
      if (citedLabels.size > 0) {
        setActiveChatRefs((prev) =>
          prev.filter((ref) => !citedLabels.has(`R${ref.referenceNumber}`.toUpperCase()))
        );
      }

      // Add AI response to chat history
      const finalChatHistory = [
        ...updatedChatHistory,
        {
          role: 'assistant',
          content: aiResponse,
          timestamp: Date.now()
        }
      ];

      updateHighlightChatHistory(pageNum, highlightId, finalChatHistory);

      if (threadId && supabase && accountId && workspaceId) {
        await supabase.from('thread_messages').insert({
          thread_id: threadId,
          workspace_id: workspaceId,
          account_id: accountId,
          role: 'assistant',
          content: aiResponse,
          content_json: {},
          citations_json: [],
          created_by: accountId
        });
      }

      if (effectiveHighlight.annotationId && supabase) {
        await supabase
          .from('annotations')
          .update({
            anchor_json: {
              rects: effectiveHighlight.rects || [],
              aiType: effectiveHighlight.aiType,
              aiContent: finalChatHistory?.[0]?.content || effectiveHighlight.aiContent || null,
              chatHistory: finalChatHistory,
              threadId,
              pageWidth: pageWidth || null
            }
          })
          .eq('id', effectiveHighlight.annotationId);
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
      // Add error message to chat history
      const errorChatHistory = [
        ...updatedChatHistory,
        {
          role: 'assistant',
          content: 'Sorry, there was an error processing your message. Please try again.',
          timestamp: Date.now()
        }
      ];
      updateHighlightChatHistory(pageNum, highlightId, errorChatHistory);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- Cross-source synthesis (drag-and-drop reference onto selected text) ---
  const handleSelectedTextDrop = useCallback((event, rectIdx) => {
    if (!selectedText || !selectedRange || !selectionDropRects.length) return;
    const types = Array.from(event?.dataTransfer?.types || []);
    if (!types.includes('application/lumi-reference')) return;
    event.preventDefault();
    event.stopPropagation();

    let reference = null;
    try {
      const raw = event.dataTransfer.getData('application/lumi-reference');
      if (raw) reference = JSON.parse(raw);
    } catch {
      reference = null;
    }
    if (!reference) return;

    const baseRect = selectionDropRects[Math.max(0, rectIdx)] || selectionDropRects[0];
    const position = baseRect
      ? { x: baseRect.left + baseRect.width / 2, y: baseRect.top }
      : { x: event.clientX, y: event.clientY };

    setCrossSourceMenu({
      pageNum: currentPageInView,
      reference,
      position,
      selectedText,
      selectedRange: selectedRange.cloneRange ? selectedRange.cloneRange() : selectedRange,
    });
  }, [selectedText, selectedRange, selectionDropRects, currentPageInView]);

  const dismissCrossSourceMenu = useCallback(() => {
    setCrossSourceMenu(null);
  }, []);

  const handleCrossSourceAction = async (actionId) => {
    if (!crossSourceMenu) return;
    const {
      pageNum,
      reference,
      selectedText: menuSelectedText,
      selectedRange: menuSelectedRange,
    } = crossSourceMenu;
    if (!menuSelectedText || !menuSelectedRange) {
      setCrossSourceMenu(null);
      return;
    }

    setCrossSourceMenu(null);
    const highlightResult = addHighlight(menuSelectedText, menuSelectedRange, pageNum, 'chat', null);
    if (!highlightResult?.highlight) return;
    const persisted = await persistHighlight(highlightResult.pageNum, highlightResult.highlight);
    const resolvedId = persisted?.annotationId || highlightResult.highlight.id;
    selectHighlight(highlightResult.pageNum, resolvedId);
    setSelectedText(highlightResult.highlight.text);
    setSelectedRange(null);
    setSelectionDropRects([]);
    window.getSelection()?.removeAllRanges?.();

    if (isPanelCollapsed) setIsPanelCollapsed(false);

    const target = {
      ...highlightResult.highlight,
      id: resolvedId,
      annotationId: persisted?.annotationId || resolvedId,
      aiType: 'chat',
      chatHistory: highlightResult.highlight.chatHistory || [],
    };

    const actionLabel = CROSS_SOURCE_ACTION_LABELS[actionId] || actionId;
    const referenceLabel = reference?.referenceNumber
      ? `R${reference.referenceNumber}`
      : 'reference';
    const refSnippet = (reference?.selectedText || reference?.text || '').trim();
    const userSummary = `${actionLabel} this passage with [${referenceLabel}]${
      refSnippet ? `: "${refSnippet.length > 220 ? refSnippet.slice(0, 220).trimEnd() + '…' : refSnippet}"` : ''
    }`;

    const baseHistory = target.chatHistory || [];
    const historyWithUser = [
      ...baseHistory,
      { role: 'user', content: userSummary, timestamp: Date.now() },
    ];
    updateHighlightChatHistory(highlightResult.pageNum, target.id, historyWithUser);

    const effectiveHighlight = {
      ...target,
      annotationId: target.annotationId || target.id,
      aiType: 'chat',
    };

    let threadId = effectiveHighlight.threadId;
    if (!threadId) {
      threadId = await ensureThreadForHighlight(highlightResult.pageNum, effectiveHighlight);
    }

    if (threadId && supabase && accountId && workspaceId) {
      await supabase.from('thread_messages').insert({
        thread_id: threadId,
        workspace_id: workspaceId,
        account_id: accountId,
        role: 'user',
        content: userSummary,
        content_json: { kind: 'cross-source', action: actionId, referenceId: reference?.id || null },
        citations_json: [],
        created_by: accountId,
      });
    }

    setIsChatLoading(true);
    try {
      const result = await crossSourceWithAI({
        action: actionId,
        highlight: {
          id: effectiveHighlight.annotationId || effectiveHighlight.id,
          text: effectiveHighlight.text || '',
          sourceDocId: docId || undefined,
          sourceDocTitle: fileName || undefined,
          pageNumber: highlightResult.pageNum,
        },
        reference: {
          id: reference.id,
          text: reference.selectedText || reference.text || '',
          referenceNumber: reference.referenceNumber || null,
          sourceDocId: reference.sourceDocId,
          sourceDocTitle: reference.sourceDocTitle,
          pageNumber: reference.pageNumber || null,
        },
      });

      const assistantContent = result.response || '';
      const finalHistory = [
        ...historyWithUser,
        { role: 'assistant', content: assistantContent, timestamp: Date.now() },
      ];
      updateHighlightChatHistory(highlightResult.pageNum, target.id, finalHistory);

      if (threadId && supabase && accountId && workspaceId) {
        await supabase.from('thread_messages').insert({
          thread_id: threadId,
          workspace_id: workspaceId,
          account_id: accountId,
          role: 'assistant',
          content: assistantContent,
          content_json: {
            kind: 'cross-source',
            action: actionId,
            referenceId: reference?.id || null,
          },
          citations_json: [],
          created_by: accountId,
        });
      }

      if (effectiveHighlight.annotationId && supabase) {
        await supabase
          .from('annotations')
          .update({
            has_thread: true,
            anchor_json: {
              rects: effectiveHighlight.rects || [],
              aiType: effectiveHighlight.aiType,
              aiContent: finalHistory?.[0]?.content || effectiveHighlight.aiContent || null,
              chatHistory: finalHistory,
              threadId,
              referenceId: effectiveHighlight.referenceId || null,
              pageWidth: pageWidth || null,
            },
          })
          .eq('id', effectiveHighlight.annotationId);
      }
    } catch (error) {
      console.error('Cross-source synthesis failed', error);
      const errorHistory = [
        ...historyWithUser,
        {
          role: 'assistant',
          content: 'Sorry, I could not complete that cross-source operation. Please try again.',
          timestamp: Date.now(),
        },
      ];
      updateHighlightChatHistory(highlightResult.pageNum, target.id, errorHistory);
    } finally {
      setIsChatLoading(false);
    }
  };

  const removeHighlightFromState = (pageNum, targetId) => {
    setHighlights((prev) => {
      const pageHighlights = prev[pageNum] || [];
      const filtered = pageHighlights.filter(
        (h) => h.id !== targetId && h.annotationId !== targetId
      );
      return {
        ...prev,
        [pageNum]: filtered,
      };
    });
  };

  const handleDeleteHighlight = async () => {
    if (!selectedHighlightId) return;
    const { pageNum, highlightId } = selectedHighlightId;
    const target = (highlights[pageNum] || []).find(
      (h) => h.id === highlightId || h.annotationId === highlightId
    );
    if (!target) return;

    setIsDeletingHighlight(true);
    try {
      if (supabase && target.annotationId) {
        await supabase.from('annotations').delete().eq('id', target.annotationId);
      }
    } catch (error) {
      console.error('Failed to delete highlight', error);
    } finally {
      setIsDeletingHighlight(false);
    }

    removeHighlightFromState(pageNum, target.annotationId || target.id);
    clearSelectedHighlight();
    setSelectedText('');
    setSelectedRange(null);
  };

  // Save reference and attach it to the current file
  const handleSaveReference = async () => {
    if (!selectedText || !docId || !folderId || !accountId) return;
    const ref = await addReference(accountId, {
      folderId,
      sourceDocId: docId,
      sourceDocTitle: fileName || null,
      pageNumber: currentPageInView || null,
      selectedText,
    });
    if (ref) {
      let referenceHighlightMeta = null;
      if (selectedRange) {
        const highlightResult = addHighlight(selectedText, selectedRange, currentPageInView, 'reference', null);
        if (highlightResult?.highlight) {
          updateHighlight(highlightResult.pageNum, highlightResult.highlight.id, { referenceId: ref.id });
          const persisted = await persistHighlight(highlightResult.pageNum, {
            ...highlightResult.highlight,
            referenceId: ref.id
          });
          const resolvedId = persisted?.annotationId || highlightResult.highlight.id;
          updateHighlight(highlightResult.pageNum, resolvedId, { referenceId: ref.id });
          referenceHighlightMeta = {
            pageNum: highlightResult.pageNum,
            highlightId: resolvedId
          };

          if (persisted?.annotationId && supabase) {
            const target = (highlights[highlightResult.pageNum] || []).find(
              (h) => h.id === resolvedId || h.annotationId === resolvedId
            );
            await supabase
              .from('annotations')
              .update({
                anchor_json: {
                  rects: target?.rects || highlightResult.highlight.rects || [],
                  aiType: 'reference',
                  aiContent: null,
                  chatHistory: target?.chatHistory || [],
                  referenceId: ref.id,
                  pageWidth: pageWidth || null
                }
              })
              .eq('id', persisted.annotationId);
          }
        }
      }

      // Attach to the current document so it shows in this file's AI chat
      await attachToFile(accountId, ref.id);
      setRefSavedFlash(true);
      setTimeout(() => setRefSavedFlash(false), 2000);

      if (typeof window !== 'undefined') {
        window.parent?.postMessage(
          {
            type: 'reference:created',
            reference: ref
          },
          '*'
        );
        window.parent?.postMessage(
          {
            type: 'reference:focus',
            referenceId: ref.id,
            highlight: referenceHighlightMeta
          },
          '*'
        );
      }
    }
    setMenuPosition(null);
    setSelectedRange(null);
    setSelectionDropRects([]);
    window.getSelection().removeAllRanges();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuPosition && !e.target.closest('.selection-menu')) {
        setMenuPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuPosition]);

  // Get selected highlight for display
  const currentPageHighlights = highlights[currentPageInView] || [];

  const showRightPanel = Boolean(
    selectedHighlight && ['chat', 'explanation', 'reference'].includes(selectedHighlight.aiType)
  );

  const handleGoToSynthesisFromReference = useCallback((usageEntry) => {
    if (!usageEntry?.synthesisDocId) return;
    if (typeof window !== 'undefined') {
      window.parent?.postMessage(
        {
          type: 'synthesis:navigate',
          synthesisDocId: usageEntry.synthesisDocId,
          referenceId: selectedHighlight?.referenceId || null,
        },
        '*'
      );
    }
  }, [selectedHighlight?.referenceId]);

  if (!pdfFile) {
    return null;
  }

  const effectivePageWidth = pageWidth ? pageWidth * zoom : undefined;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden relative">
      {/* Header (hidden when embedded) */}
      {!hideHeader && (
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20"
              aria-label="Go to home"
            >
              <Sparkles className="w-6 h-6 text-white" />
            </button>
            <div className="leading-tight">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
                Lumi
              </p>
              <h1 className="text-lg font-semibold text-slate-900">{fileName || 'Lumi'}</h1>
            </div>
          </div>

          {numPages && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-light">
                {currentPageInView} <span className="text-slate-300">/</span> {numPages}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Reference saved flash */}
      {refSavedFlash && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-2 rounded-lg shadow-md animate-fade-in">
          <BookmarkCheck className="w-4 h-4" />
          Reference saved
        </div>
      )}

      {/* Zoom controls (always visible) */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm px-2 py-1 shadow-sm">
          <button
            type="button"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
            onClick={() => setZoom((z) => Math.max(0.5, parseFloat((z - 0.1).toFixed(2))))}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-xs font-medium text-slate-700 w-12 text-center">
            {(zoom * 100).toFixed(0)}%
          </span>
          <button
            type="button"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
            onClick={() => setZoom((z) => Math.min(2.5, parseFloat((z + 0.1).toFixed(2))))}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden min-h-0 select-none">
        {/* PDF Viewer - Scrollable */}
        <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-100/50 select-text" onMouseUp={handleTextSelection}>
          <PDFViewer
            pdfFile={pdfFile}
            numPages={numPages}
            pageWidth={effectivePageWidth}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            highlights={highlights}
            selectedHighlightId={selectedHighlightId}
            onHighlightClick={onHighlightClick}
            pdfContainerRef={pdfContainerRef}
          />

          {selectionDropRects.map((rect, idx) => (
            <div
              key={`selection-drop-${idx}`}
              className="absolute z-[120] rounded-sm bg-transparent border border-transparent"
              style={{
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
              }}
              onDragOver={(event) => {
                const types = Array.from(event?.dataTransfer?.types || []);
                if (!types.includes('application/lumi-reference')) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(event) => handleSelectedTextDrop(event, idx)}
            />
          ))}

          {/* Selection Menu */}
          {!crossSourceMenu && (
            <SelectionMenu
              menuPosition={menuPosition}
              onAIChat={handleAIChatClick}
              onHighlight={handleHighlight}
              onSaveReference={handleSaveReference}
            />
          )}

          {/* Cross-source contextual action menu */}
          <CrossSourceMenu
            position={crossSourceMenu?.position || null}
            reference={crossSourceMenu?.reference || null}
            onSelectAction={handleCrossSourceAction}
            onDismiss={dismissCrossSourceMenu}
          />

          {/* Page Highlights */}
          <PageHighlights
            highlights={currentPageHighlights}
            currentPageInView={currentPageInView}
          />
        </div>

        {showRightPanel && (
          <>
            <div
              className="w-1.5 cursor-col-resize bg-transparent hover:bg-slate-200 active:bg-slate-300 flex-shrink-0"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = rightPanelWidth;
                const onMove = (ev) => {
                  const delta = ev.clientX - startX;
                  const next = Math.min(Math.max(startWidth - delta, minRight), maxRight);
                  setRightPanelWidth(next);
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            />
            <div
              className="border-l border-slate-200/60 bg-white/90 backdrop-blur-sm flex-shrink-0 overflow-hidden"
              style={{
                width: isPanelCollapsed ? 48 : rightPanelWidth,
                minWidth: isPanelCollapsed ? 48 : minRight,
                maxWidth: isPanelCollapsed ? 48 : maxRight,
              }}
            >
              <div className="h-full flex flex-col">
                <div className={isPanelCollapsed ? 'h-full' : 'flex-1 min-h-0'}>
                  <ExplanationPanel
                    isCollapsed={isPanelCollapsed}
                    onToggleCollapse={() => setIsPanelCollapsed((v) => !v)}
                    selectedText={selectedText}
                    selectedHighlight={selectedHighlight}
                    isLoading={false}
                    explanation={null}
                    summary={null}
                    referenceCheck={null}
                    onSendChatMessage={handleSendChatMessage}
                    isChatLoading={isChatLoading}
                    onDeleteHighlight={handleDeleteHighlight}
                    isDeletingHighlight={isDeletingHighlight}
                    referenceUsageEntries={selectedReferenceUsages}
                    isReferenceUsageLoading={isLoadingSelectedReferenceUsages}
                    onGoToSynthesisUsage={handleGoToSynthesisFromReference}
                    activeChatRefs={activeChatRefs}
                    onRemoveActiveChatRef={(refId) =>
                      setActiveChatRefs((prev) => prev.filter((ref) => ref.id !== refId))
                    }
                  />
                </div>

              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
