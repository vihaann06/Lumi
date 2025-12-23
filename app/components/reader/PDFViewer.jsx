import React from 'react';
import { Document, Page } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import HighlightOverlay from './HighlightOverlay';

/**
 * PDF Viewer Component
 */
export default function PDFViewer({ 
  pdfFile, 
  numPages, 
  pageWidth, 
  onDocumentLoadSuccess,
  highlights,
  selectedHighlightId,
  onHighlightClick,
  pdfContainerRef
}) {
  return (
    <div ref={pdfContainerRef} className="flex flex-col items-center p-8 space-y-4">
      <Document
        file={pdfFile}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        }
      >
        {Array.from(new Array(numPages), (el, index) => {
          const pageNum = index + 1;
          const pageHighlights = highlights[pageNum] || [];
          return (
            <div key={`page_${pageNum}`} data-page-number={pageNum} className="mb-4 relative">
              <Page
                pageNumber={pageNum}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="bg-white shadow-2xl"
              />
              <HighlightOverlay
                highlights={pageHighlights}
                pageNum={pageNum}
                pageWidth={pageWidth}
                selectedHighlightId={selectedHighlightId}
                onHighlightClick={onHighlightClick}
                pdfContainerRef={pdfContainerRef}
              />
            </div>
          );
        })}
      </Document>
    </div>
  );
}

