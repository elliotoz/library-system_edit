'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Send, ImageIcon, X, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { renderMessage } from '@/lib/renderMessage';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
}

interface BookContext {
  id: string;
  title: string;
  authors: string[];
  category: string | null;
}

// ── Role-aware suggested questions ────────────────────────────────────────────

function getSuggestions(role?: string, facultyName?: string | null): string[] {
  const faculty = facultyName || 'my faculty';
  switch (role) {
    case 'STUDENT':
      return [
        `Find books for ${faculty}`,
        'What books are due soon?',
        'Recommend something like my recent borrows',
        'How do I extend a loan?',
      ];
    case 'INSTRUCTOR':
      return [
        'Find research papers on a topic',
        'Summarise a book for my students',
        'Help write a reading list description',
        'Find books for my course',
      ];
    case 'STAFF':
      return [
        'Search catalog by subject',
        'Check book availability',
        'Explain borrow policies',
        'Help with a student query',
      ];
    case 'ADMIN':
      return [
        'Library usage statistics',
        'Find overdue books summary',
        'Book catalog search',
        'System help',
      ];
    default:
      return [
        'What books do you recommend?',
        'How do I borrow a book?',
        'Search the catalog',
        'Show reading lists',
      ];
  }
}

// ── Image compression ─────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const bookId = searchParams.get('book');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [pendingImage, setPendingImage] = useState<{ base64: string; preview: string } | null>(null);
  const [bookContext, setBookContext] = useState<BookContext | null>(null);
  const [bookContextDismissed, setBookContextDismissed] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextSentRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync with state for stale-closure-free access in sendMessage
  useEffect(() => {
    messagesRef.current = messages;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check AI status
  useEffect(() => {
    fetch('/api/ai/status', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setAiOnline(d?.available ?? false))
      .catch(() => setAiOnline(false));
  }, []);

  // Load conversation history
  useEffect(() => {
    fetch('/api/ai/history', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((history: { id: string; role: string; content: string }[]) => {
        if (history.length > 0) {
          setMessages(
            history.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          );
        }
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, []);

  // Fetch book context
  useEffect(() => {
    if (!bookId) return;
    fetch(`/api/books/${bookId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setBookContext({ id: d.id, title: d.title, authors: d.authors ?? [], category: d.category }); })
      .catch(() => null);
  }, [bookId]);

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string, imgBase64?: string | null) => {
    if ((!text.trim() && !imgBase64) || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim() || 'What can you tell me about this image?',
      imagePreview: imgBase64 ? `data:image/jpeg;base64,${imgBase64}` : undefined,
    };

    const assistantMsgId = `assistant-${Date.now() + 1}`;
    const assistantMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '' };

    // Capture history BEFORE adding new messages
    const history = messagesRef.current
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setPendingImage(null);
    setIsStreaming(true);

    try {

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMsg.content,
          history,
          hasImage: !!imgBase64,
          imageBase64: imgBase64 ?? null,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const parsed = JSON.parse(raw) as { text?: string; error?: string };
            if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: m.content + parsed.text } : m,
                ),
              );
            }
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
            : m,
        ),
      );
    }

    setIsStreaming(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send book context
  useEffect(() => {
    if (!bookContext || !historyLoaded || contextSentRef.current) return;
    contextSentRef.current = true;
    const authorsStr = bookContext.authors.length > 0 ? ` by ${bookContext.authors.join(', ')}` : '';
    sendMessage(`I'm looking at "${bookContext.title}"${authorsStr}${bookContext.category ? ` (${bookContext.category})` : ''}. Can you give me a study guide and recommend related books?`);
  }, [bookContext, historyLoaded, sendMessage]);

  const handleSend = () => {
    if ((!input.trim() && !pendingImage) || isStreaming) return;
    sendMessage(input.trim(), pendingImage?.base64 ?? null);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const base64 = await compressImage(file);
      setPendingImage({ base64, preview: `data:image/jpeg;base64,${base64}` });
      inputRef.current?.focus();
    } catch { /* ignore */ }
  };

  const suggestions = getSuggestions(user?.role, user?.facultyName);
  const showSuggestions = historyLoaded && messages.length === 0 && !bookId;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-[#2A9D9D] to-[#1a7a7a] rounded-xl flex items-center justify-center shadow-md shadow-[#2A9D9D]/20 flex-shrink-0">
          <span className="text-white font-bold text-sm">AI</span>
        </div>
        <div className="flex-1 min-w-0">
          {user && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Hello, <span className="font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
            </p>
          )}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">AI Library Assistant</h1>
        </div>
        {aiOnline !== null && (
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0',
            aiOnline
              ? 'bg-[#2A9D9D]/15 text-[#2A9D9D] dark:text-[#4bbfbf]'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          )}>
            {aiOnline ? '● ÜLIB AI' : '● Offline'}
          </span>
        )}
      </div>

      {/* Book context banner */}
      {bookContext && !bookContextDismissed && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#2A9D9D]/10 border border-[#2A9D9D]/30 rounded-xl">
          <BookOpen className="w-4 h-4 text-[#2A9D9D] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#2A9D9D] dark:text-[#4bbfbf] font-medium truncate">
              Study help for:{' '}
              <Link href={`/dashboard/catalog/${bookContext.id}`} className="underline underline-offset-2 hover:opacity-80">
                {bookContext.title}
              </Link>
            </p>
            {bookContext.authors.length > 0 && (
              <p className="text-xs text-[#2A9D9D]/70 mt-0.5">{bookContext.authors.join(', ')}</p>
            )}
          </div>
          <button onClick={() => setBookContextDismissed(true)} className="text-[#2A9D9D]/50 hover:text-[#2A9D9D]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat container */}
      <div className="flex-1 glass-card overflow-hidden flex flex-col min-h-0">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

          {/* Empty state */}
          {showSuggestions && (
            <div className="h-full flex flex-col items-center justify-center gap-6 py-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#2A9D9D] to-[#1a7a7a] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#2A9D9D]/20">
                  <span className="text-white font-bold text-xl">AI</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {user ? `Hello, ${user.name.split(' ')[0]}!` : 'Hello!'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">How can I help you today?</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {suggestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(q)}
                    className="text-left px-4 py-3 rounded-xl text-sm text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 hover:border-[#2A9D9D]/50 hover:bg-[#2A9D9D]/5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            return (
              <div key={msg.id} className={cn('flex gap-3 items-start', msg.role === 'user' ? 'flex-row-reverse' : '')}>

                {/* Avatar */}
                {msg.role === 'assistant' ? (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2A9D9D] to-[#1a7a7a] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white font-bold text-[10px]">AI</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white/80 font-semibold text-xs">
                      {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                    </span>
                  </div>
                )}

                {/* Bubble */}
                <div className={cn(
                  'max-w-[78%] rounded-2xl px-4 py-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-[#2A9D9D]/20 border border-[#2A9D9D]/30 backdrop-blur-sm rounded-tr-sm'
                    : 'bg-white/[0.05] border border-white/[0.08] backdrop-blur-sm rounded-tl-sm',
                )}>
                  {/* Image preview in user message */}
                  {msg.imagePreview && (
                    <img
                      src={msg.imagePreview}
                      alt="Attached"
                      className="max-w-xs rounded-lg mb-2 border border-white/20"
                    />
                  )}

                  {/* Content */}
                  {msg.role === 'assistant' ? (
                    <div className="leading-relaxed">
                      {renderMessage(msg.content)}
                      {/* Streaming cursor */}
                      {isStreaming && isLast && (
                        <span className="inline-block w-2 h-4 bg-[#2A9D9D] rounded-sm animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-white/90">{msg.content}</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator (before first token arrives) */}
          {isStreaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2A9D9D] to-[#1a7a7a] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-[10px]">AI</span>
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#2A9D9D] rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-[#2A9D9D] rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-[#2A9D9D] rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Image preview strip */}
        {pendingImage && (
          <div className="px-4 pb-2 flex items-center gap-2 border-t border-white/[0.06] pt-2">
            <div className="relative inline-block">
              <img src={pendingImage.preview} alt="To send" className="h-16 w-16 object-cover rounded-lg border border-white/20" />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <span className="text-xs text-gray-400">Image ready to send</span>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-white/[0.08] p-3">
          <div className="flex gap-2 items-end">
            {/* Image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              title="Attach image"
              className={cn(
                'p-2.5 rounded-xl border transition-colors flex-shrink-0',
                pendingImage
                  ? 'border-[#2A9D9D]/60 bg-[#2A9D9D]/10 text-[#2A9D9D]'
                  : 'border-white/20 text-gray-400 hover:text-[#2A9D9D] hover:border-[#2A9D9D]/40',
                isStreaming && 'opacity-40 cursor-not-allowed',
              )}
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={pendingImage ? 'Ask about this image...' : 'Ask me anything about books...'}
              disabled={isStreaming}
              className="flex-1 px-4 py-2.5 bg-white/[0.06] border border-white/20 rounded-2xl focus:ring-2 focus:ring-[#2A9D9D]/40 focus:border-[#2A9D9D]/50 text-sm placeholder:text-gray-400 text-gray-200 dark:text-gray-200 backdrop-blur-md disabled:opacity-50"
            />

            <button
              onClick={handleSend}
              disabled={(!input.trim() && !pendingImage) || isStreaming}
              className="p-2.5 bg-gradient-to-br from-[#2A9D9D] to-[#1a7a7a] text-white rounded-xl hover:from-[#33b5b5] hover:to-[#228888] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-[#2A9D9D]/20 flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
