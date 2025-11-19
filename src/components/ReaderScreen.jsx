import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Lightbulb, FileText, Search, Highlighter, ChevronRight, ChevronLeft } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function ReaderScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get file URL from route state or sessionStorage
  const getFileUrl = () => {
    if (location.state?.fileUrl) {
      return location.state.fileUrl;
    }
    
    // Try to restore from sessionStorage
    const base64 = sessionStorage.getItem('pdfFile');
    if (base64) {
      // Convert base64 back to blob URL
      const byteCharacters = atob(base64.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    }
    
    return null;
  };
  
  const [pdfFile, setPdfFile] = useState(() => getFileUrl());
  const [numPages, setNumPages] = useState(null);
  const [highlights, setHighlights] = useState({});
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [summary, setSummary] = useState('');
  const [referenceCheck, setReferenceCheck] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [pageWidth, setPageWidth] = useState(800);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const containerRef = useRef(null);
  const pdfContainerRef = useRef(null);

  useEffect(() => {
    if (!pdfFile) {
      navigate('/');
    }
  }, [pdfFile, navigate]);

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

  const [currentPageInView, setCurrentPageInView] = useState(1);
  
  useEffect(() => {
    if (!pdfContainerRef.current || !numPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.dataset.pageNumber);
            setCurrentPageInView(pageNum);
          }
        });
      },
      { threshold: 0.5 }
    );

    const pages = pdfContainerRef.current.querySelectorAll('[data-page-number]');
    pages.forEach((page) => observer.observe(page));

    return () => {
      pages.forEach((page) => observer.unobserve(page));
    };
  }, [numPages, pdfFile]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleTextSelection = (e) => {
    if (e.target.closest('.highlight-overlay')) {
      return;
    }
    
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text.length > 0) {
        setSelectedText(text);
        setActiveHighlight(null);
        
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectedRange(range);
        
        const container = containerRef.current;
        if (container) {
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

  const handleHighlight = () => {
    if (selectedText && selectedRange) {
      const clientRects = selectedRange.getClientRects();
      if (clientRects.length === 0) return;
      
      const pages = pdfContainerRef.current?.querySelectorAll('[data-page-number]');
      let pageElement = null;
      let pageNum = currentPageInView;
      const firstRect = clientRects[0];
      
      if (pages) {
        for (const page of pages) {
          const pageRect = page.getBoundingClientRect();
          const selectionCenterY = firstRect.top + firstRect.height / 2;
          if (selectionCenterY >= pageRect.top && selectionCenterY <= pageRect.bottom) {
            pageElement = page;
            pageNum = parseInt(page.dataset.pageNumber);
            break;
          }
        }
      }
      
      if (pageElement) {
        const pageRect = pageElement.getBoundingClientRect();
        const currentPageHighlights = highlights[pageNum] || [];
        
        const highlightRects = Array.from(clientRects).map(rect => ({
          x: rect.left - pageRect.left,
          y: rect.top - pageRect.top,
          width: rect.width,
          height: rect.height
        }));
        
        const highlightId = Date.now();
        const newHighlight = {
          id: highlightId,
          text: selectedText,
          timestamp: Date.now(),
          rects: highlightRects
        };
        
        setHighlights({
          ...highlights,
          [pageNum]: [...currentPageHighlights, newHighlight]
        });
        
        setActiveHighlight({ pageNum, highlightId });
        setSelectedText(selectedText);
      } else {
        const currentPageHighlights = highlights[pageNum] || [];
        const pageElement = pdfContainerRef.current?.querySelector(`[data-page-number="${pageNum}"]`);
        
        if (pageElement) {
          const pageRect = pageElement.getBoundingClientRect();
          const highlightRects = Array.from(clientRects).map(rect => ({
            x: rect.left - pageRect.left,
            y: rect.top - pageRect.top,
            width: rect.width,
            height: rect.height
          }));
          
          const highlightId = Date.now();
          const newHighlight = {
            id: highlightId,
            text: selectedText,
            timestamp: Date.now(),
            rects: highlightRects
          };
          
          setHighlights({
            ...highlights,
            [pageNum]: [...currentPageHighlights, newHighlight]
          });
          
          setActiveHighlight({ pageNum, highlightId });
          setSelectedText(selectedText);
        }
      }
      
      setMenuPosition(null);
      setSelectedRange(null);
      window.getSelection().removeAllRanges();
    }
  };

  const handleAIExplain = async () => {
    if (!selectedText) return;
    
    setIsLoading(true);
    setActiveAction('explain');
    setMenuPosition(null);
    setSummary('');
    setReferenceCheck('');
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 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',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Please explain the following text in a clear and accessible way:\n\n"${selectedText}"`
          }],
          max_tokens: 1000,
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        setExplanation(data.choices[0].message.content);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error) {
      setExplanation('Sorry, there was an error getting the explanation. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      window.getSelection().removeAllRanges();
    }
  };

  const handleAISummary = async () => {
    if (!selectedText) return;
    
    setIsLoading(true);
    setActiveAction('summary');
    setMenuPosition(null);
    setExplanation('');
    setReferenceCheck('');
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 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',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Please provide a concise summary of the following text:\n\n"${selectedText}"`
          }],
          max_tokens: 1000,
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        setSummary(data.choices[0].message.content);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error) {
      setSummary('Sorry, there was an error getting the summary. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      window.getSelection().removeAllRanges();
    }
  };

  const handleReferenceCheck = async () => {
    if (!selectedText) return;
    
    setIsLoading(true);
    setActiveAction('reference');
    setMenuPosition(null);
    setExplanation('');
    setSummary('');
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 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',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Please check if the following text contains any factual claims, statistics, or references that should be verified. If so, identify what needs to be checked and suggest how to verify it:\n\n"${selectedText}"`
          }],
          max_tokens: 1000,
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        setReferenceCheck(data.choices[0].message.content);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error) {
      setReferenceCheck('Sorry, there was an error checking references. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      window.getSelection().removeAllRanges();
    }
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

  const currentPageHighlights = highlights[currentPageInView] || [];

  if (!pdfFile) {
    return null;
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900">PDF Reader with AI</h1>
        
        {numPages && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              Page {currentPageInView} of {numPages}
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* PDF Viewer - Scrollable */}
        <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div ref={pdfContainerRef} className="flex flex-col items-center p-8 space-y-4" onMouseUp={handleTextSelection}>
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
                    {/* Highlight Overlay */}
                    {pageHighlights.length > 0 && (
                      <div className="absolute top-0 left-0 highlight-overlay pointer-events-none" style={{ width: `${pageWidth}px` }}>
                        {pageHighlights.map((highlight, idx) => {
                          const rects = highlight.rects || [{
                            x: highlight.x,
                            y: highlight.y,
                            width: highlight.width,
                            height: highlight.height
                          }];
                          
                          const highlightId = highlight.id || idx;
                          const isActive = activeHighlight?.pageNum === pageNum && activeHighlight?.highlightId === highlightId;
                          
                          return (
                            <React.Fragment key={highlightId}>
                              {rects.map((rect, rectIdx) => (
                                <div
                                  key={rectIdx}
                                  className={`absolute rounded-sm cursor-pointer transition-all pointer-events-auto ${
                                    isActive 
                                      ? 'bg-yellow-200 opacity-60 ring-2 ring-yellow-400' 
                                      : 'bg-yellow-100 opacity-40 hover:opacity-50'
                                  }`}
                                  style={{
                                    left: `${rect.x}px`,
                                    top: `${rect.y}px`,
                                    width: `${rect.width}px`,
                                    height: `${rect.height}px`,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveHighlight({ pageNum, highlightId });
                                    setSelectedText(highlight.text);
                                    setMenuPosition(null);
                                    setExplanation('');
                                    setSummary('');
                                    setReferenceCheck('');
                                    setActiveAction(null);
                                  }}
                                />
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </Document>
          </div>

          {/* Selection Menu */}
          {menuPosition && (
            <div
              className="selection-menu absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2"
              style={{
                left: `${menuPosition.x}px`,
                top: `${menuPosition.y}px`,
                transform: 'translate(-50%, -100%)',
                marginTop: '-8px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-2">
                <button
                  onClick={handleAIExplain}
                  className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Lightbulb className="w-4 h-4" />
                  AI Explanation
                </button>
                <button
                  onClick={handleAISummary}
                  className="px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <FileText className="w-4 h-4" />
                  AI Summary
                </button>
                <button
                  onClick={handleReferenceCheck}
                  className="px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Search className="w-4 h-4" />
                  Reference Check
                </button>
                <button
                  onClick={handleHighlight}
                  className="px-3 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-50 rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Highlighter className="w-4 h-4" />
                  Highlight
                </button>
              </div>
            </div>
          )}

          {/* Page Highlights */}
          {currentPageHighlights.length > 0 && (
            <div className="w-full max-w-2xl bg-white rounded-lg shadow p-4 mx-auto">
              <h3 className="font-semibold text-sm text-gray-900 mb-3">
                Highlights on page {currentPageInView} ({currentPageHighlights.length})
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

        {/* Explanation Panel */}
        <div className={`bg-white border-l border-gray-200 overflow-y-auto flex flex-col transition-all duration-300 ${isPanelCollapsed ? 'w-12' : 'w-96'}`}>
          {isPanelCollapsed ? (
            <div className="flex flex-col items-center py-4">
              <button
                onClick={() => setIsPanelCollapsed(false)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Expand panel"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          ) : (
            <>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-blue-600" />
                  AI Explanation
                </h2>
                <button
                  onClick={() => setIsPanelCollapsed(true)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Collapse panel"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              
              <div className="p-4 flex-1">
                {selectedText && (
                  <div className={`mb-4 p-3 rounded-lg border ${
                    activeHighlight 
                      ? 'bg-yellow-50 border-yellow-200' 
                      : 'bg-blue-50 border-blue-100'
                  }`}>
                    <p className={`text-sm font-medium mb-1 ${
                      activeHighlight ? 'text-yellow-900' : 'text-blue-900'
                    }`}>
                      {activeHighlight ? 'Active Highlight:' : 'Selected Text:'}
                    </p>
                    <p className={`text-sm italic ${
                      activeHighlight ? 'text-yellow-800' : 'text-blue-800'
                    }`}>
                      "{selectedText}"
                    </p>
                  </div>
                )}
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : explanation ? (
                  <div className="prose prose-sm max-w-none">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-blue-600" />
                      Explanation
                    </h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{explanation}</p>
                  </div>
                ) : summary ? (
                  <div className="prose prose-sm max-w-none">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-600" />
                      Summary
                    </h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{summary}</p>
                  </div>
                ) : referenceCheck ? (
                  <div className="prose prose-sm max-w-none">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Search className="w-5 h-5 text-green-600" />
                      Reference Check
                    </h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{referenceCheck}</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select text and choose an action from the menu</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

