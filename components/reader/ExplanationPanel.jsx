'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Lightbulb, FileText, Search, ChevronRight, ChevronLeft, Send, Trash } from 'lucide-react';
import { truncateTextForDisplay } from '@/lib/utils/highlightUtils';

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
  isChatLoading,
  onDeleteHighlight,
  isDeletingHighlight
}) {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Get chat history from selected highlight (only for explanations)
  const chatHistory = selectedHighlight?.chatHistory || [];
  const hasChatHistory = chatHistory.length > 0;
  const isExplanationHighlight = selectedHighlight?.aiType === 'explanation';

  // Scroll to bottom when chat history updates
  useEffect(() => {
    if (!shouldAutoScroll) return;
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatLoading, shouldAutoScroll]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      setShouldAutoScroll(nearBottom);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !onSendChatMessage || !selectedHighlight) return;
    
    onSendChatMessage(chatInput.trim());
    setChatInput('');
  };

  if (isCollapsed) {
    return (
      <div className="bg-white/80 backdrop-blur-sm border-l border-slate-200/60 overflow-y-auto flex flex-col transition-all duration-300 w-12">
        <div className="flex flex-col items-center py-4">
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-slate-100/50 rounded-lg transition-colors"
            title="Expand panel"
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm border-l border-slate-200/60 flex flex-col transition-all duration-300 w-96 shadow-lg">
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-5 py-4 flex items-center justify-between z-10">
        <h2 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-indigo-500" />
          AI Explanation
        </h2>
        <div className="flex items-center gap-2">
          {selectedHighlight && onDeleteHighlight ? (
            <button
              onClick={onDeleteHighlight}
              disabled={isDeletingHighlight}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              title="Delete highlight"
            >
              {isDeletingHighlight ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash className="w-4 h-4" />
              )}
            </button>
          ) : null}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-slate-100/50 rounded-lg transition-colors"
            title="Collapse panel"
          >
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Selected Text Display */}
        {(selectedText || selectedHighlight) && (
          <div className={`p-4 border-b border-slate-200/60 ${
            selectedHighlight?.aiType === 'explanation'
              ? 'bg-indigo-50/30'
              : selectedHighlight?.aiType === 'summary'
              ? 'bg-purple-50/30'
              : selectedHighlight
              ? 'bg-amber-50/30'
              : 'bg-slate-50/50'
          }`}>
            <p className={`text-xs font-medium mb-2 uppercase tracking-wide ${
              selectedHighlight?.aiType === 'explanation'
                ? 'text-indigo-600'
                : selectedHighlight?.aiType === 'summary'
                ? 'text-purple-600'
                : selectedHighlight
                ? 'text-amber-600'
                : 'text-slate-500'
            }`}>
              {selectedHighlight ? 'Selected Highlight' : 'Selected Text'}
            </p>
            <p className={`text-sm leading-relaxed ${
              selectedHighlight?.aiType === 'explanation'
                ? 'text-indigo-900'
                : selectedHighlight?.aiType === 'summary'
                ? 'text-purple-900'
                : selectedHighlight
                ? 'text-amber-900'
                : 'text-slate-700'
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
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {chatHistory.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-slate-200/60 p-4 bg-white/50">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-300 text-sm text-slate-700 placeholder:text-slate-400 transition-all"
                  disabled={isChatLoading || !selectedHighlight}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading || !selectedHighlight}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-sm text-slate-400">Thinking...</p>
            </div>
          </div>
        ) : (selectedHighlight?.aiContent && selectedHighlight.aiType === 'explanation') || explanation ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700">Explanation</h3>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedHighlight?.aiContent && selectedHighlight.aiType === 'explanation' 
                  ? selectedHighlight.aiContent 
                  : explanation}
              </p>
            </div>
          </div>
        ) : (selectedHighlight?.aiContent && selectedHighlight.aiType === 'summary') || summary ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700">Summary</h3>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedHighlight?.aiContent && selectedHighlight.aiType === 'summary' 
                  ? selectedHighlight.aiContent 
                  : summary}
              </p>
            </div>
          </div>
        ) : referenceCheck ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Search className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700">Reference Check</h3>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{referenceCheck}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center px-8">
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
                <Lightbulb className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400 font-light">Select text and choose an action</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
