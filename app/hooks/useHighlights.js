'use client'

import { useState } from 'react';
import { calculateHighlightRects, findPageForSelection, createHighlight, mergeOverlappingRects } from '@/lib/utils/highlightUtils';

/**
 * Custom hook for highlight management
 */
export const useHighlights = (currentPageInView, pdfContainerRef) => {
  const [highlights, setHighlights] = useState({});
  const [selectedHighlightId, setSelectedHighlightId] = useState(null);

  const addHighlight = (selectedText, selectedRange, currentPageInView, aiType = null, aiContent = null) => {
    if (!selectedText || !selectedRange) return;

    const clientRects = selectedRange.getClientRects();
    if (clientRects.length === 0) return;

    const pages = pdfContainerRef.current?.querySelectorAll('[data-page-number]');
    const { pageElement, pageNum } = findPageForSelection(clientRects, pages, currentPageInView);

    let pageRect;
    if (pageElement) {
      pageRect = pageElement.getBoundingClientRect();
    } else {
      const element = pdfContainerRef.current?.querySelector(`[data-page-number="${pageNum}"]`);
      if (!element) return;
      pageRect = element.getBoundingClientRect();
    }

    let highlightRects = calculateHighlightRects(clientRects, pageRect);
    // Merge overlapping rectangles within the highlight
    highlightRects = mergeOverlappingRects(highlightRects);
    const newHighlight = createHighlight(selectedText, highlightRects, aiType, aiContent);
    const currentPageHighlights = highlights[pageNum] || [];

    setHighlights({
      ...highlights,
      [pageNum]: [...currentPageHighlights, newHighlight]
    });

    return { highlight: newHighlight, pageNum };
  };

  const selectHighlight = (pageNum, highlightId) => {
    setSelectedHighlightId({ pageNum, highlightId });
  };

  const getSelectedHighlight = () => {
    if (!selectedHighlightId) return null;
    
    const { pageNum, highlightId } = selectedHighlightId;
    const pageHighlights = highlights[pageNum] || [];
    return pageHighlights.find(h => h.id === highlightId) || null;
  };

  const clearSelectedHighlight = () => {
    setSelectedHighlightId(null);
  };

  const updateHighlightChatHistory = (pageNum, highlightId, chatHistory) => {
    setHighlights(prev => {
      const pageHighlights = prev[pageNum] || [];
      const updatedHighlights = pageHighlights.map(h => 
        h.id === highlightId 
          ? { ...h, chatHistory, aiContent: chatHistory.length > 0 ? chatHistory[0].content : h.aiContent }
          : h
      );
      return {
        ...prev,
        [pageNum]: updatedHighlights
      };
    });
  };

  return {
    highlights,
    selectedHighlightId,
    addHighlight,
    selectHighlight,
    getSelectedHighlight,
    clearSelectedHighlight,
    updateHighlightChatHistory
  };
};

