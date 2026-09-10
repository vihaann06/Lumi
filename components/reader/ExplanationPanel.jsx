'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Loader2, MessageSquare, FileText, Search, ChevronRight, ChevronLeft, Send, Trash, Link2, ArrowUpRight, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { truncateTextForDisplay } from '@/lib/utils/highlightUtils';
import ReferenceTextHoverPreview from '@/components/references/ReferenceTextHoverPreview';

/**
 * Reader AI panel (chat-first, with legacy summary/reference support)
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
  isDeletingHighlight,
  referenceUsageEntries = [],
  isReferenceUsageLoading = false,
  onGoToSynthesisUsage,
  activeChatRefs = [],
  onRemoveActiveChatRef
}) {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const previousChatLengthRef = useRef(0);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const chatHistory = selectedHighlight?.chatHistory || [];
  const isChatHighlight = selectedHighlight?.aiType === 'chat' || selectedHighlight?.aiType === 'explanation';
  const isReferenceHighlight = selectedHighlight?.aiType === 'reference';

  const markdownComponents = {
    h1: ({ children }) => <h1 className="text-base font-semibold mt-2 mb-1">{children}</h1>,
    h2: ({ children }) => <h2 className="text-sm font-semibold mt-2 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
    p: ({ children }) => <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-2">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-2">{children}</ol>,
    li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ children }) => (
      <code className="text-[12px] bg-slate-200/70 text-slate-800 rounded px-1 py-0.5">{children}</code>
    ),
    pre: ({ children }) => (
      <pre className="text-[12px] bg-slate-200/70 text-slate-800 rounded-lg p-2 overflow-x-auto mb-2">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-600 italic mb-2">{children}</blockquote>
    ),
  };

  useEffect(() => {
    const hasNewChatContent = chatHistory.length > previousChatLengthRef.current || isChatLoading;
    previousChatLengthRef.current = chatHistory.length;
    if (!hasNewChatContent || !shouldAutoScroll) return;
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [chatHistory.length, isChatLoading, shouldAutoScroll]);

  useEffect(() => {
    previousChatLengthRef.current = chatHistory.length;
    setShouldAutoScroll(true);
  }, [selectedHighlight?.id]);

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
      <div className="h-full flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-slate-100/50 rounded-lg transition-colors"
          title="Expand panel"
        >
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    );
  }

  if (isReferenceHighlight) {
    return (
      <div className="h-full flex flex-col">
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-emerald-500" />
            Reference links
          </h2>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-slate-100/50 rounded-lg transition-colors"
            title="Collapse panel"
          >
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            {isReferenceUsageLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading linked syntheses...
              </div>
            ) : referenceUsageEntries.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-600">
                  This reference is not cited in any synthesis yet.
                </p>
              </div>
            ) : (
              <>
                <div className="text-xs text-slate-500">
                  Used in {referenceUsageEntries.length}{' '}
                  {referenceUsageEntries.length === 1 ? 'synthesis' : 'syntheses'}
                </div>
                <div className="space-y-2">
                  {referenceUsageEntries.map((usage) => (
                    <div
                      key={usage.synthesisDocId}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {usage.synthesisTitle || 'Untitled synthesis'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Cited {usage.citationCount}x
                            {usage.firstLine ? ` · line ${usage.firstLine}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onGoToSynthesisUsage?.(usage)}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                          Go to synthesis
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-5 py-4 flex items-center justify-between z-10">
        <h2 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          AI Chat
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

      {activeChatRefs.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-200/60 bg-slate-50/50">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Using {activeChatRefs.length} reference{activeChatRefs.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeChatRefs.map((ref) => (
              <div
                key={ref.id}
                className="flex items-center gap-1.5 text-xs bg-white rounded-md border border-slate-200 pl-2 pr-1 py-1"
              >
                <span className="text-indigo-500 font-semibold">R{ref.referenceNumber}</span>
                <ReferenceTextHoverPreview
                  text={ref.selectedText || ''}
                  layout="inline"
                  subheading={`${ref.sourceDocTitle || 'Source'}${ref.pageNumber != null ? ` · p.${ref.pageNumber}` : ''}`}
                >
                  <span className="text-slate-500 max-w-[100px] truncate cursor-default">{ref.selectedText}</span>
                </ReferenceTextHoverPreview>
                <button
                  type="button"
                  onClick={() => onRemoveActiveChatRef?.(ref.id)}
                  className="p-0.5 text-slate-400 hover:text-rose-500"
                  title="Remove reference"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {isChatHighlight ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-5 space-y-4"
              onWheel={(e) => e.stopPropagation()}
            >
              {chatHistory.length === 0 ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-indigo-800">
                  Ask anything about this highlight. This chat stays attached to this exact highlight.
                </div>
              ) : null}

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
                    {message.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    )}
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

            <div className="border-t border-slate-200/60 p-4 bg-white/50">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about this highlighted passage..."
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
        ) : (selectedHighlight?.aiContent && selectedHighlight.aiType === 'summary') || summary ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700">Summary</h3>
              </div>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {selectedHighlight?.aiContent && selectedHighlight.aiType === 'summary'
                  ? selectedHighlight.aiContent
                  : summary}
              </ReactMarkdown>
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
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {referenceCheck}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center px-8">
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
                <MessageSquare className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400 font-light">Select text and choose Chat</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
