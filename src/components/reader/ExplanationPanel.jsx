import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Lightbulb, FileText, Search, ChevronRight, ChevronLeft, Send, MessageSquare } from 'lucide-react';
import { truncateTextForDisplay } from '../../utils/highlightUtils';

/**
 * Explanation Panel Component with Chat Interface
 */
export default function ExplanationPanel({
  isCollapsed,
  onToggleCollapse,
  selectedText,
  selectedHighlight,
  isLoading,
  explanation,
  summary,
  referenceCheck,
  onSendChatMessage,
  isChatLoading
}) {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Get chat history from selected highlight (only for explanations)
  const chatHistory = selectedHighlight?.chatHistory || [];
  const hasChatHistory = chatHistory.length > 0;
  const isExplanationHighlight = selectedHighlight?.aiType === 'explanation';

  // Scroll to bottom when chat history updates
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatLoading]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !onSendChatMessage || !selectedHighlight) return;
    
    onSendChatMessage(chatInput.trim());
    setChatInput('');
  };

  if (isCollapsed) {
    return (
      <div className="bg-white border-l border-gray-200 overflow-y-auto flex flex-col transition-all duration-300 w-12">
        <div className="flex flex-col items-center py-4">
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Expand panel"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-l border-gray-200 flex flex-col transition-all duration-300 w-96">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-blue-600" />
          AI Explanation
        </h2>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Collapse panel"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Selected Text Display */}
        {(selectedText || selectedHighlight) && (
          <div className={`p-4 border-b ${
            selectedHighlight?.aiType === 'explanation'
              ? 'bg-blue-50 border-blue-200'
              : selectedHighlight?.aiType === 'summary'
              ? 'bg-purple-50 border-purple-200'
              : selectedHighlight
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-blue-50 border-blue-100'
          }`}>
            <p className={`text-sm font-medium mb-1 ${
              selectedHighlight?.aiType === 'explanation'
                ? 'text-blue-900'
                : selectedHighlight?.aiType === 'summary'
                ? 'text-purple-900'
                : selectedHighlight
                ? 'text-yellow-900'
                : 'text-blue-900'
            }`}>
              {selectedHighlight ? 'Selected Highlight:' : 'Selected Text:'}
            </p>
            <p className={`text-sm italic ${
              selectedHighlight?.aiType === 'explanation'
                ? 'text-blue-800'
                : selectedHighlight?.aiType === 'summary'
                ? 'text-purple-800'
                : selectedHighlight
                ? 'text-yellow-800'
                : 'text-blue-800'
            }`}>
              "{truncateTextForDisplay(selectedHighlight ? selectedHighlight.text : selectedText)}"
            </p>
          </div>
        )}

        {/* Chat Interface for AI Explanations Only */}
        {isExplanationHighlight && hasChatHistory ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat Messages */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {chatHistory.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-200 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isChatLoading || !selectedHighlight}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading || !selectedHighlight}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (selectedHighlight?.aiContent && selectedHighlight.aiType === 'explanation') || explanation ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="prose prose-sm max-w-none">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-blue-600" />
                Explanation
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {selectedHighlight?.aiContent && selectedHighlight.aiType === 'explanation' 
                  ? selectedHighlight.aiContent 
                  : explanation}
              </p>
            </div>
          </div>
        ) : (selectedHighlight?.aiContent && selectedHighlight.aiType === 'summary') || summary ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="prose prose-sm max-w-none">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Summary
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {selectedHighlight?.aiContent && selectedHighlight.aiType === 'summary' 
                  ? selectedHighlight.aiContent 
                  : summary}
              </p>
            </div>
          </div>
        ) : referenceCheck ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="prose prose-sm max-w-none">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Search className="w-5 h-5 text-green-600" />
                Reference Check
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">{referenceCheck}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-gray-400 py-8">
            <div>
              <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select text and choose an action from the menu</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
