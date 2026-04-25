'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Send, ImageIcon, X, BookOpen, History, Plus, Trash2, MessageSquare, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { renderMessage } from '@/lib/renderMessage';
import { BookCitationCards } from '@/components/BookCitationCards';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BookCitation {
  title: string;
  catalogLink: string;
  available: boolean;
  copies: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
  fileName?: string;
  citations?: BookCitation[];
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface BookContext {
  id: string;
  title: string;
  authors: string[];
  category: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function formatConvTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

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

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [pendingImage, setPendingImage] = useState<{ base64: string; preview: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; text: string; wordCount: number; totalWordCount: number; truncated: boolean } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [bookContext, setBookContext] = useState<BookContext | null>(null);
  const [bookContextDismissed, setBookContextDismissed] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Refs for stale-closure-free access
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextSentRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeConvRef = useRef<string | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    activeConvRef.current = activeConversationId;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversationId, messages]);

  // ── Load conversations ────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations', { credentials: 'include' });
      const data: Conversation[] = res.ok ? await res.json() : [];
      setConversations(data);
      return data;
    } catch {
      return [];
    }
  }, []);

  const loadConversationMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/ai/history?conversationId=${convId}`, { credentials: 'include' });
      const history: { id: string; role: string; content: string }[] = res.ok ? await res.json() : [];
      setMessages(
        history.map((m) => {
          const fileMatch = m.content.match(/^\[ATTACHED FILE: (.+?) —/);
          const displayContent = fileMatch
            ? m.content.replace(/^\[ATTACHED FILE:.*?---\n\n?/s, '').trim() || `📎 ${fileMatch[1]}`
            : m.content;
          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: displayContent,
            fileName: fileMatch ? fileMatch[1] : undefined,
          };
        }),
      );
    } catch {
      setMessages([]);
    }
    setHistoryLoaded(true);
  }, []);

  const switchConversation = useCallback(async (convId: string) => {
    setActiveConversationId(convId);
    setSidebarOpen(false);
    setMessages([]);
    setHistoryLoaded(false);
    await loadConversationMessages(convId);
  }, [loadConversationMessages]);

  const createNewChat = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return;
      const conv: Conversation = await res.json();
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setMessages([]);
      setHistoryLoaded(true);
      setSidebarOpen(false);
      inputRef.current?.focus();
    } catch { /* ignore */ }
  }, []);

  const handleDeleteConversation = useCallback(async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(convId);
    try {
      await fetch(`/api/ai/conversations/${convId}`, { method: 'DELETE', credentials: 'include' });
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== convId);
        // If deleting the active conversation, switch to next or create new
        if (activeConvRef.current === convId) {
          if (remaining.length > 0) {
            switchConversation(remaining[0].id);
          } else {
            setActiveConversationId(null);
            setMessages([]);
            setHistoryLoaded(true);
          }
        }
        return remaining;
      });
    } catch { /* ignore */ }
    setDeletingId(null);
  }, [switchConversation]);

  // ── Bootstrap on mount ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/ai/status', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setAiOnline(d?.available ?? false))
      .catch(() => setAiOnline(false));
  }, []);

  useEffect(() => {
    (async () => {
      const convs = await loadConversations();
      if (convs.length > 0) {
        setActiveConversationId(convs[0].id);
        await loadConversationMessages(convs[0].id);
      } else {
        // Auto-create first conversation
        try {
          const res = await fetch('/api/ai/conversations', { method: 'POST', credentials: 'include' });
          if (res.ok) {
            const conv: Conversation = await res.json();
            setConversations([conv]);
            setActiveConversationId(conv.id);
          }
        } catch { /* ignore */ }
        setHistoryLoaded(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Book context
  useEffect(() => {
    if (!bookId) return;
    fetch(`/api/books/${bookId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setBookContext({ id: d.id, title: d.title, authors: d.authors ?? [], category: d.category }); })
      .catch(() => null);
  }, [bookId]);

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string, imgBase64?: string | null) => {
    if ((!text.trim() && !imgBase64 && !pendingFile) || isStreaming) return;

    const convId = activeConvRef.current;

    const userMessage = text.trim() || (imgBase64 ? 'What can you tell me about this image?' : pendingFile ? 'What does this file say?' : '');
    // Capture before state is cleared
    const capturedFile = pendingFile;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      imagePreview: imgBase64 ? `data:image/jpeg;base64,${imgBase64}` : undefined,
      fileName: pendingFile?.name,
    };

    const assistantMsgId = `assistant-${Date.now() + 1}`;
    const assistantMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '' };

    const history = messagesRef.current
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setPendingImage(null);
    setPendingFile(null);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          history,
          hasImage: !!imgBase64,
          imageBase64: imgBase64 ?? null,
          conversationId: convId,
          fileContent: capturedFile?.text ?? undefined,
          fileName: capturedFile?.name ?? undefined,
        }),
      });

      if (response.status === 429) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: 'Rate limit reached. Please wait a moment before sending another message.' }
              : m,
          ),
        );
        setIsStreaming(false);
        return;
      }

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
            const parsed = JSON.parse(raw) as { text?: string; books?: BookCitation[]; error?: string };
            if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: m.content + parsed.text } : m,
                ),
              );
            }
            if (parsed.books) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, citations: parsed.books } : m,
                ),
              );
            }
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: `Error: ${parsed.error}` } : m,
                ),
              );
            }
          } catch { /* ignore malformed chunks */ }
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

    // Refresh conversation list to get updated title
    loadConversations().then((updated) => setConversations(updated));
  }, [isStreaming, loadConversations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send book context
  useEffect(() => {
    if (!bookContext || !historyLoaded || contextSentRef.current) return;
    contextSentRef.current = true;
    const authorsStr = bookContext.authors.length > 0 ? ` by ${bookContext.authors.join(', ')}` : '';
    sendMessage(`I'm looking at "${bookContext.title}"${authorsStr}${bookContext.category ? ` (${bookContext.category})` : ''}. Can you give me a study guide and recommend related books?`);
  }, [bookContext, historyLoaded, sendMessage]);

  const handleSend = () => {
    if ((!input.trim() && !pendingImage && !pendingFile) || isStreaming) return;
    sendMessage(input.trim(), pendingImage?.base64 ?? null);
  };

  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 50 * 1024 * 1024) {
      alert('File is too large. Maximum size is 50 MB.');
      return;
    }
    setFileUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/ai/upload-file', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        const status = res.status;
        let userMessage = err.message ?? 'Failed to process the file. Please try again.';
        if (status === 413) userMessage = 'File is too large. Maximum allowed size is 50 MB.';
        if (status === 415 || status === 400) userMessage = err.message ?? 'Unsupported file type or format.';
        if (status === 500) userMessage = 'OZ could not read this file. It may be scanned, image-based, password-protected, or corrupted.';
        setPendingFile(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `**File upload failed:** ${userMessage}`,
          },
        ]);
        return;
      }
      const data = await res.json() as { text: string; wordCount: number; totalWordCount: number; truncated: boolean; filename: string };
      setPendingFile({ name: data.filename, text: data.text, wordCount: data.wordCount, totalWordCount: data.totalWordCount, truncated: data.truncated });
      inputRef.current?.focus();
    } catch {
      alert('Failed to upload file. Please try again.');
    } finally {
      setFileUploading(false);
    }
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col gap-3 relative overflow-hidden">

      {/* ── History sidebar ───────────────────────────────────────────────────── */}

      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 z-20 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar panel */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 z-30 w-72 flex flex-col',
          'bg-gray-950/98 backdrop-blur-xl border-r border-white/10',
          'transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <span className="text-sm font-semibold text-white/90">Chat History</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 py-3 border-b border-white/[0.06]">
          <button
            onClick={createNewChat}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#2A9D9D]/15 border border-[#2A9D9D]/30 text-[#2A9D9D] hover:bg-[#2A9D9D]/25 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-white/20" />
              <p className="text-xs text-white/30">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => switchConversation(conv.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 mx-1 rounded-xl transition-colors group',
                  'flex items-start justify-between gap-2',
                  conv.id === activeConversationId
                    ? 'bg-[#2A9D9D]/15 text-white'
                    : 'text-white/70 hover:bg-white/[0.05] hover:text-white',
                )}
                style={{ width: 'calc(100% - 8px)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-tight">
                    {conv.title || 'New Chat'}
                  </p>
                  <p className="text-[11px] text-white/35 mt-0.5">
                    {formatConvTime(conv.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  disabled={deletingId === conv.id}
                  className={cn(
                    'flex-shrink-0 p-1 rounded-lg transition-colors mt-0.5',
                    'opacity-0 group-hover:opacity-100',
                    'text-white/30 hover:text-red-400 hover:bg-red-400/10',
                    conv.id === activeConversationId && 'opacity-40 group-hover:opacity-100',
                    deletingId === conv.id && 'opacity-100 animate-pulse',
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Header ────────────────────────────────────────────────────────────── */}

      <div className="flex items-center gap-3">
        {/* History toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl border border-white/20 text-gray-400 hover:text-[#2A9D9D] hover:border-[#2A9D9D]/40 transition-colors flex-shrink-0"
          title="Chat history"
        >
          <History className="w-5 h-5" />
        </button>

        <div className="w-11 h-11 bg-gradient-to-br from-[#2A9D9D] to-[#1a7a7a] rounded-xl flex items-center justify-center shadow-md shadow-[#2A9D9D]/20 flex-shrink-0">
          <span className="text-white font-bold text-sm">OZ</span>
        </div>
        <div className="flex-1 min-w-0">
          {user && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Hello, <span className="font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
            </p>
          )}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">OZ AI</h1>
        </div>

        {/* New chat button */}
        <button
          onClick={createNewChat}
          disabled={isStreaming}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 text-gray-400 hover:text-[#2A9D9D] hover:border-[#2A9D9D]/40 transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-40"
          title="New chat"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>

        {aiOnline !== null && (
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0',
            aiOnline
              ? 'bg-[#2A9D9D]/15 text-[#2A9D9D] dark:text-[#4bbfbf]'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          )}>
            {aiOnline ? '● OZ AI' : '● Offline'}
          </span>
        )}
      </div>

      {/* ── Book context banner ───────────────────────────────────────────────── */}

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

      {/* ── Chat container ────────────────────────────────────────────────────── */}

      <div className="flex-1 glass-card overflow-hidden flex flex-col min-h-0">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

          {/* Empty state */}
          {showSuggestions && (
            <div className="h-full flex flex-col items-center justify-center gap-6 py-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#2A9D9D] to-[#1a7a7a] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#2A9D9D]/20">
                  <span className="text-white font-bold text-xl">OZ</span>
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
                    <span className="text-white font-bold text-[10px]">OZ</span>
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
                  {msg.imagePreview && (
                    <img
                      src={msg.imagePreview}
                      alt="Attached"
                      className="max-w-xs rounded-lg mb-2 border border-white/20"
                    />
                  )}
                  {msg.fileName && (
                    <div className="flex items-center gap-3 mb-2 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] w-fit max-w-[260px]">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#2A9D9D]/20 border border-[#2A9D9D]/30 shrink-0">
                        <svg className="w-5 h-5 text-[#2A9D9D]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white/90 truncate">{msg.fileName}</p>
                        <p className="text-xs text-white/40">{msg.fileName.split('.').pop()?.toUpperCase()} document</p>
                      </div>
                    </div>
                  )}
                  {msg.role === 'assistant' ? (
                    <div className="leading-relaxed">
                      {renderMessage(msg.content)}
                      {msg.citations && msg.citations.length > 0 && (
                        <BookCitationCards citations={msg.citations} />
                      )}
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

          {/* Typing indicator */}
          {isStreaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2A9D9D] to-[#1a7a7a] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-[10px]">OZ</span>
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

        {/* File badge strip */}
        {pendingFile && (
          <div className="px-4 pb-2 flex items-center gap-2 border-t border-white/[0.06] pt-2 flex-wrap">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${pendingFile.truncated ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/[0.06] border-white/[0.12]'}`}>
              <Paperclip className={`w-4 h-4 flex-shrink-0 ${pendingFile.truncated ? 'text-yellow-400' : 'text-[#2A9D9D]'}`} />
              <span className="text-xs text-gray-300 truncate max-w-[180px]">{pendingFile.name}</span>
              {pendingFile.truncated ? (
                <span className="text-xs text-yellow-400 font-medium">
                  {pendingFile.wordCount.toLocaleString()} / {pendingFile.totalWordCount.toLocaleString()} words
                </span>
              ) : (
                <span className="text-xs text-gray-500">{pendingFile.wordCount.toLocaleString()} words</span>
              )}
              <button onClick={() => setPendingFile(null)} className="ml-1 text-gray-500 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {pendingFile.truncated ? (
              <span className="text-xs text-yellow-400">Truncated to fit AI context — ask a question about it</span>
            ) : (
              <span className="text-xs text-gray-400">File ready — ask a question about it</span>
            )}
          </div>
        )}

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
            <span className="text-xs text-gray-400">Image ready — ask a question or send as-is</span>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-white/[0.08] p-3">
          <div className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={handleDocSelect}
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
            <button
              onClick={() => docInputRef.current?.click()}
              disabled={isStreaming || fileUploading}
              title="Attach PDF, DOCX, or TXT"
              className={cn(
                'p-2.5 rounded-xl border transition-colors flex-shrink-0',
                pendingFile
                  ? 'border-[#2A9D9D]/60 bg-[#2A9D9D]/10 text-[#2A9D9D]'
                  : 'border-white/20 text-gray-400 hover:text-[#2A9D9D] hover:border-[#2A9D9D]/40',
                (isStreaming || fileUploading) && 'opacity-40 cursor-not-allowed',
              )}
            >
              {fileUploading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={pendingFile ? 'Ask a question about the file...' : pendingImage ? 'Ask about this image...' : 'Ask me anything about books...'}
              disabled={isStreaming}
              className="flex-1 px-4 py-2.5 bg-white/[0.06] border border-white/20 rounded-2xl focus:ring-2 focus:ring-[#2A9D9D]/40 focus:border-[#2A9D9D]/50 text-sm placeholder:text-gray-400 text-gray-200 dark:text-gray-200 backdrop-blur-md disabled:opacity-50"
            />

            <button
              onClick={handleSend}
              disabled={(!input.trim() && !pendingImage && !pendingFile) || isStreaming}
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
