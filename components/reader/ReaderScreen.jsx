'use client'

import React, { useState, useRef, useEffect } from 'react';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useRouter, useSearchParams, useParams } from 'next/navigation';

// Hooks
import { usePDFViewer } from '@/hooks/usePDFViewer';
import { useHighlights } from '@/hooks/useHighlights';
import { useAIActions } from '@/hooks/useAIActions';

// Services
import { chatWithAI } from '@/lib/services/ai/actions';
import { getSupabaseClient } from '@/lib/db/supabaseClient';

// Components
import PDFViewer from '../../components/reader/PDFViewer';
import SelectionMenu from '../../components/reader/SelectionMenu';
import ExplanationPanel from '../../components/reader/ExplanationPanel';
import PageHighlights from '../../components/reader/PageHighlights';
import { Sparkles } from 'lucide-react';

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
    selectedHighlightId,
    addHighlight,
    selectHighlight,
    getSelectedHighlight,
    clearSelectedHighlight,
    updateHighlightChatHistory,
    setHighlightsMap,
    updateHighlight
  } = useHighlights(currentPageInView, pdfContainerRef);

  // AI Actions hook - pass callback to create AI highlights
  const {
    explanation,
    summary,
    referenceCheck,
    isLoading,
    activeAction,
    handleAIExplain,
    handleAISummary,
    handleReferenceCheck,
    clearAIActions
  } = useAIActions((selectedText, selectedRange, currentPageInView, aiType, aiContent) => {
    return addHighlight(selectedText, selectedRange, currentPageInView, aiType, aiContent);
  });

  // Local state for text selection
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isDeletingHighlight, setIsDeletingHighlight] = useState(false);
  const [fileName, setFileName] = useState('Lumi');
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

  // Load persisted annotations + threads
  useEffect(() => {
    const loadAnnotations = async () => {
      if (!supabase || !docId) return;
      const { data: annotations, error } = await supabase
        .from('annotations')
        .select('id, page, quote, anchor_json, has_thread')
        .eq('doc_id', docId);
      if (error) {
        console.error('Failed to load annotations', error);
        return;
      }

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
          threadId
        };

        if (!map[annotation.page]) map[annotation.page] = [];
        map[annotation.page].push(highlight);
      });

      setHighlightsMap(map);
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
        has_thread: highlight.aiType === 'explanation'
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

    if (highlight.aiType === 'explanation' && annotationId) {
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
        clearSelectedHighlight();
        clearAIActions();
        
        const range = selection.getRangeAt(0);
        setSelectedRange(range);
        
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
      window.getSelection().removeAllRanges();
    }
  };

  // Handle highlight click
  const onHighlightClick = (pageNum, highlightId) => {
    selectHighlight(pageNum, highlightId);
    const highlight = highlights[pageNum]?.find(h => h.id === highlightId);
    if (highlight) {
      setSelectedText(highlight.text);
      setMenuPosition(null);
      
      // If it's not an AI highlight, clear AI actions
      // The ExplanationPanel will show AI content from the highlight if it exists
      if (!highlight.aiType || !highlight.aiContent) {
        clearAIActions();
      }
    }
  };

  // Handle AI actions with selected text
  const handleAIExplainClick = async () => {
    const highlightResult = await handleAIExplain(selectedText, selectedRange, currentPageInView);
    setMenuPosition(null);
    
    // Automatically select the highlight to show chat interface
    if (highlightResult && highlightResult.highlight) {
      const persisted = await persistHighlight(highlightResult.pageNum, highlightResult.highlight);
      const resolvedId = persisted?.annotationId || highlightResult.highlight.id;
      selectHighlight(highlightResult.pageNum, resolvedId);
      setSelectedText(highlightResult.highlight.text);
    }
  };

  const handleAISummaryClick = async () => {
    const highlightResult = await handleAISummary(selectedText, selectedRange, currentPageInView);
    if (highlightResult?.highlight) {
      await persistHighlight(highlightResult.pageNum, highlightResult.highlight);
    }
    setMenuPosition(null);
    // Summaries don't have chat functionality, so we don't auto-select them
  };

  // Handle chat message (only for explanations, not summaries)
  const handleSendChatMessage = async (message) => {
    if (!selectedHighlight || !selectedHighlightId || selectedHighlight.aiType !== 'explanation') return;

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
      const aiResponse = await chatWithAI(
        selectedHighlight.text,
        updatedChatHistory,
        message
      );

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
    clearAIActions();
    setSelectedText('');
    setSelectedRange(null);
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
  const selectedHighlight = getSelectedHighlight();
  const currentPageHighlights = highlights[currentPageInView] || [];

  if (!pdfFile) {
    return null;
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
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

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* PDF Viewer - Scrollable */}
        <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-100/50" onMouseUp={handleTextSelection}>
          <PDFViewer
            pdfFile={pdfFile}
            numPages={numPages}
            pageWidth={pageWidth}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            highlights={highlights}
            selectedHighlightId={selectedHighlightId}
            onHighlightClick={onHighlightClick}
            pdfContainerRef={pdfContainerRef}
          />

          {/* Selection Menu */}
          <SelectionMenu
            menuPosition={menuPosition}
            onAIExplain={handleAIExplainClick}
            onAISummary={handleAISummaryClick}
            onHighlight={handleHighlight}
          />

          {/* Page Highlights */}
          <PageHighlights
            highlights={currentPageHighlights}
            currentPageInView={currentPageInView}
          />
        </div>

        {/* Explanation Panel */}
        <ExplanationPanel
          isCollapsed={isPanelCollapsed}
          onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
          selectedText={selectedText}
          selectedHighlight={selectedHighlight}
          isLoading={isLoading}
          explanation={explanation}
          summary={summary}
          referenceCheck={referenceCheck}
          onSendChatMessage={handleSendChatMessage}
        isChatLoading={isChatLoading}
        onDeleteHighlight={handleDeleteHighlight}
        isDeletingHighlight={isDeletingHighlight}
        />
      </div>
    </div>
  );
}
