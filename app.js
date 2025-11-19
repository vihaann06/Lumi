import React, { useState, useRef, useEffect } from 'react';
import { Upload, Loader2, X, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function PDFReader() {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [highlights, setHighlights] = useState({});
  const [selectedText, setSelectedText] = useState('');
  const [menuPosition, setMenuPosition] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [pageWidth, setPageWidth] = useState(800);
  const containerRef = useRef(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setPageWidth(Math.min(containerWidth - 100, 900));
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(URL.createObjectURL(file));
      setPageNumber(1);
      setHighlights({});
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleTextSelection = (e) => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text.length > 0) {
        setSelectedText(text);
        
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + window.scrollY - 10
        });
      } else {
        setMenuPosition(null);
      }
    }, 10);
  };

  const handleHighlight = () => {
    if (selectedText) {
      const pageKey = pageNumber;
      const currentPageHighlights = highlights[pageKey] || [];
      
      setHighlights({
        ...highlights,
        [pageKey]: [...currentPageHighlights, {
          text: selectedText,
          timestamp: Date.now()
        }]
      });
      
      setMenuPosition(null);
      window.getSelection().removeAllRanges();
    }
  };

  const handleAIExplain = async () => {
    if (!selectedText) return;
    
    setIsLoading(true);
    setShowExplanation(true);
    setMenuPosition(null);
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Please explain the following text in a clear and accessible way:\n\n"${selectedText}"`
          }]
        })
      });

      const data = await response.json();
      const explanationText = data.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
      
      setExplanation(explanationText);
    } catch (error) {
      setExplanation('Sorry, there was an error getting the explanation. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      window.getSelection().removeAllRanges();
    }
  };

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages));
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuPosition && !e.target.closest('.selection-menu')) {
        setMenuPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuPosition]);

  const currentPageHighlights = highlights[pageNumber] || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">PDF Reader with AI</h1>
        
        {pdfFile && numPages && (
          <div className="flex items-center gap-4">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-700">
              Page {pageNumber} of {numPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div ref={containerRef} className="flex-1 overflow-auto p-8">
          {!pdfFile ? (
            <div className="flex items-center justify-center h-full">
              <label className="flex flex-col items-center justify-center w-full max-w-xl h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-12 h-12 mb-4 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PDF files only</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div 
                className="bg-white shadow-2xl relative"
                onMouseUp={handleTextSelection}
              >
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    width={pageWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>

                {/* Selection Menu */}
                {menuPosition && (
                  <div
                    className="selection-menu fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 flex gap-2 p-2"
                    style={{
                      left: `${menuPosition.x}px`,
                      top: `${menuPosition.y}px`,
                      transform: 'translate(-50%, -100%)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={handleHighlight}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                      Highlight
                    </button>
                    <button
                      onClick={handleAIExplain}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1"
                    >
                      <Lightbulb className="w-4 h-4" />
                      AI Explain
                    </button>
                  </div>
                )}
              </div>

              {/* Page Highlights */}
              {currentPageHighlights.length > 0 && (
                <div className="mt-6 w-full max-w-2xl bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold text-sm text-gray-900 mb-3">
                    Highlights on this page ({currentPageHighlights.length})
                  </h3>
                  <div className="space-y-2">
                    {currentPageHighlights.map((highlight, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-gray-700 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400"
                      >
                        "{highlight.text}"
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Explanation Panel */}
        {showExplanation && (
          <div className="w-96 bg-white border-l border-gray-200 overflow-auto flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-blue-600" />
                AI Explanation
              </h2>
              <button
                onClick={() => setShowExplanation(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-auto">
              {selectedText && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm font-medium text-blue-900 mb-1">Selected Text:</p>
                  <p className="text-sm text-blue-800 italic">"{selectedText}"</p>
                </div>
              )}
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{explanation}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}