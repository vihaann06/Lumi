'use client'

import React, { useState, useRef, useEffect } from 'react';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Hooks
import { usePDFViewer } from '../hooks/usePDFViewer';
import { useHighlights } from '../hooks/useHighlights';
import { useAIActions } from '../hooks/useAIActions';

// Services
import { chatWithAI } from '@/lib/services/ai/openaiService';

// Components
import PDFViewer from './reader/PDFViewer';
import SelectionMenu from './reader/SelectionMenu';
import ExplanationPanel from './reader/ExplanationPanel';
import PageHighlights from './reader/PageHighlights';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function ReaderScreen() {
  // PDF Viewer hook
  const {
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
    updateHighlightChatHistory
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
      addHighlight(selectedText, selectedRange, currentPageInView);
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
      selectHighlight(highlightResult.pageNum, highlightResult.highlight.id);
      setSelectedText(highlightResult.highlight.text);
    }
  };

  const handleAISummaryClick = async () => {
    await handleAISummary(selectedText, selectedRange, currentPageInView);
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
        <h1 className="text-xl font-light text-slate-900 tracking-tight">Lumi</h1>
        
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
        />
      </div>
    </div>
  );
}
