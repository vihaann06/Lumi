import React, { useEffect } from 'react';

/**
 * Highlight Overlay Component
 */
export default function HighlightOverlay({ 
  highlights, 
  pageNum, 
  pageWidth,
  selectedHighlightId,
  onHighlightClick,
  pdfContainerRef
}) {
  // Enable pointer-events on text spans and overlay rectangles
  useEffect(() => {
    if (highlights.length === 0) return;
    
    const updatePointerEvents = () => {
      const pageContainer = pdfContainerRef?.current?.querySelector(`[data-page-number="${pageNum}"]`);
      if (!pageContainer) return;
      
      // Disable pointer-events on canvas to allow overlay clicks
      const canvas = pageContainer.querySelector('canvas');
      if (canvas) {
        canvas.style.pointerEvents = 'none';
        canvas.style.setProperty('pointer-events', 'none', 'important');
      }
      
      // Disable pointer-events on text layer container to allow overlay clicks
      const textLayer = pageContainer.querySelector('.react-pdf__Page__textContent');
      if (textLayer) {
        textLayer.style.pointerEvents = 'none';
        textLayer.style.setProperty('pointer-events', 'none', 'important');
        
        // Enable pointer-events on individual text spans so text selection still works
        const spans = textLayer.querySelectorAll('span');
        spans.forEach(span => {
          span.style.pointerEvents = 'auto';
          span.style.setProperty('pointer-events', 'auto', 'important');
        });
      }
      
      // Disable pointer-events on annotation layer if it exists
      const annotationLayer = pageContainer.querySelector('.react-pdf__Page__annotations');
      if (annotationLayer) {
        annotationLayer.style.pointerEvents = 'none';
        annotationLayer.style.setProperty('pointer-events', 'none', 'important');
      }
    };
    
    // Run immediately and also after a short delay to catch elements that load later
    updatePointerEvents();
    const timeoutId = setTimeout(updatePointerEvents, 100);
    requestAnimationFrame(updatePointerEvents);
    
    return () => {
      clearTimeout(timeoutId);
      // Re-enable pointer-events when component unmounts
      const pageContainer = pdfContainerRef?.current?.querySelector(`[data-page-number="${pageNum}"]`);
      if (pageContainer) {
        const canvas = pageContainer.querySelector('canvas');
        const textLayer = pageContainer.querySelector('.react-pdf__Page__textContent');
        const annotationLayer = pageContainer.querySelector('.react-pdf__Page__annotations');
        
        if (canvas) {
          canvas.style.pointerEvents = 'auto';
          canvas.style.removeProperty('pointer-events');
        }
        if (textLayer) {
          textLayer.style.pointerEvents = 'auto';
          textLayer.style.removeProperty('pointer-events');
        }
        if (annotationLayer) {
          annotationLayer.style.pointerEvents = 'auto';
          annotationLayer.style.removeProperty('pointer-events');
        }
      }
    };
  }, [pageNum, pdfContainerRef, highlights.length]);

  if (highlights.length === 0) return null;

  // Count total rectangles for logging
  const totalRects = highlights.reduce((sum, h) => sum + (h.rects?.length || 1), 0);
  if (totalRects > 50) {
    console.warn(`⚠️ Warning: Rendering ${totalRects} rectangles for ${highlights.length} highlight(s) on page ${pageNum}. This may impact performance.`);
  }

  return (
    <div 
      className="absolute top-0 left-0 highlight-overlay pointer-events-none" 
      style={{ 
        width: `${pageWidth}px`,
        zIndex: 100, // Ensure overlay is well above PDF content (canvas, text layer, etc.)
      }}
    >
      {highlights.map((highlight, idx) => {
        const rects = highlight.rects || [{
          x: highlight.x,
          y: highlight.y,
          width: highlight.width,
          height: highlight.height
        }];
        
        const highlightId = highlight.id || idx;
        const isSelected = selectedHighlightId?.pageNum === pageNum && selectedHighlightId?.highlightId === highlightId;
        const isChatHighlight = highlight.aiType === 'chat' || highlight.aiType === 'explanation';
        
        // Determine highlight color based on type
        let bgColor, bgColorSelected;
        if (isChatHighlight) {
          bgColor = 'bg-blue-100';
          bgColorSelected = 'bg-blue-200';
        } else if (highlight.aiType === 'reference') {
          bgColor = 'bg-emerald-100';
          bgColorSelected = 'bg-emerald-200';
        } else if (highlight.aiType === 'summary') {
          bgColor = 'bg-purple-100';
          bgColorSelected = 'bg-purple-200';
        } else {
          bgColor = 'bg-yellow-100';
          bgColorSelected = 'bg-yellow-200';
        }
        
        return (
          <React.Fragment key={highlightId}>
            {rects.map((rect, rectIdx) => (
              <div
                key={rectIdx}
                className={`absolute rounded-sm transition-all pointer-events-auto cursor-pointer ${
                  isSelected 
                    ? `${bgColorSelected} opacity-60` 
                    : `${bgColor} opacity-20 hover:opacity-30`
                }`}
                style={{
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  pointerEvents: 'auto', // Ensure rectangles are clickable
                  zIndex: 101, // Ensure rectangles are above everything
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onHighlightClick(pageNum, highlightId);
                }}
              />
            ))}
          </React.Fragment>
        );
      })}
    </div>
  );
}

