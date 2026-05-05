'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Plus, Trash2, MessageSquare, History, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { renderMessage } from '@/lib/renderMessage';
import { BookCitationCards } from '@/components/BookCitationCards';
import { AssistantChatInput, type ChatSendPayload } from '@/components/ui/assistant-chat-input';
import { type AiMode, type DisplayAiMode, normalizeAiModes, resolveAiModes } from '@/lib/ai-modes';

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
  citations?: BookCitation[];
}

interface ConversationModeState {
  manualModes: AiMode[];
  lastAutoModes: AiMode[];
  activeModes: AiMode[];
  isStudySession: boolean;
}

interface Conversation extends ConversationModeState {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  studyBookId?: string | null;
}

const CHAT_MODES: Array<{ value: DisplayAiMode; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'learning', label: 'Learning' },
  { value: 'explanatory', label: 'Explanatory' },
  { value: 'planning', label: 'Planning' },
  { value: 'formal', label: 'Formal' },
  { value: 'concise', label: 'Concise' },
];

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
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
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
  const conversationIdFromUrl = searchParams.get('conversation');
  const isStudySession = searchParams.get('study') === '1';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [manualModes, setManualModes] = useState<AiMode[]>([]);
  const [autoModes, setAutoModes] = useState<AiMode[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeConvRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => {
    activeConvRef.current = activeConversationId;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversationId, messages]);

  const applyModeState = useCallback((modeState?: Partial<ConversationModeState> | null) => {
    setManualModes(normalizeAiModes(modeState?.manualModes));
    setAutoModes(normalizeAiModes(modeState?.lastAutoModes));
  }, []);

  const syncConversationModes = useCallback((conversation?: Conversation | null) => {
    if (!conversation) {
      applyModeState(null);
      return;
    }

    applyModeState(conversation);
  }, [applyModeState]);

  // ── Conversations ────────────────────────────────────────────────────────────

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
      setMessages(history.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })));
    } catch {
      setMessages([]);
    }
    setHistoryLoaded(true);
  }, []);

  const switchConversation = useCallback(async (convId: string, knownConversation?: Conversation) => {
    setActiveConversationId(convId);
    setSidebarOpen(false);
    setMessages([]);
    setHistoryLoaded(false);
    syncConversationModes(knownConversation ?? conversationsRef.current.find(conv => conv.id === convId) ?? null);
    await loadConversationMessages(convId);
  }, [loadConversationMessages, syncConversationModes]);

  const createNewChat = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations', { method: 'POST', credentials: 'include' });
      if (!res.ok) return;
      const conv: Conversation = await res.json();
      setConversations(prev => [conv, ...prev]);
      setActiveConversationId(conv.id);
      syncConversationModes(conv);
      setMessages([]);
      setHistoryLoaded(true);
      setSidebarOpen(false);
    } catch { /* ignore */ }
  }, [syncConversationModes]);

  const handleDeleteConversation = useCallback(async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(convId);
    try {
      await fetch(`/api/ai/conversations/${convId}`, { method: 'DELETE', credentials: 'include' });
      setConversations(prev => {
        const remaining = prev.filter(c => c.id !== convId);
        if (activeConvRef.current === convId) {
          if (remaining.length > 0) {
            void switchConversation(remaining[0].id, remaining[0]);
          } else {
            setActiveConversationId(null);
            setMessages([]);
            setHistoryLoaded(true);
            syncConversationModes(null);
          }
        }
        return remaining;
      });
    } catch { /* ignore */ }
    setDeletingId(null);
  }, [switchConversation, syncConversationModes]);

  const persistManualModes = useCallback(async (nextManualModes: AiMode[]) => {
    setManualModes(nextManualModes);
    const convId = activeConvRef.current;
    if (!convId) return;
    try {
      await fetch(`/api/ai/conversations/${convId}/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ manualModes: nextManualModes }),
      });
    } catch { /* non-critical */ }
  }, []);

  const handleModeToggle = useCallback(async (mode: DisplayAiMode) => {
    if (mode === 'normal') {
      await persistManualModes([]);
      return;
    }

    const nextManualModes = manualModes.includes(mode)
      ? manualModes.filter((entry) => entry !== mode)
      : [...manualModes, mode];

    await persistManualModes(nextManualModes);
  }, [manualModes, persistManualModes]);

  // ── Bootstrap ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/ai/status', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setAiOnline(d?.available ?? false))
      .catch(() => setAiOnline(false));
  }, []);

  useEffect(() => {
    (async () => {
      const convs = await loadConversations();

      if (conversationIdFromUrl) {
        const conversation = convs.find(conv => conv.id === conversationIdFromUrl) ?? null;
        setActiveConversationId(conversationIdFromUrl);
        syncConversationModes(conversation);
        await loadConversationMessages(conversationIdFromUrl);
        return;
      }

      if (convs.length > 0) {
        setActiveConversationId(convs[0].id);
        syncConversationModes(convs[0]);
        await loadConversationMessages(convs[0].id);
      } else {
        try {
          const res = await fetch('/api/ai/conversations', { method: 'POST', credentials: 'include' });
          if (res.ok) {
            const conv: Conversation = await res.json();
            setConversations([conv]);
            setActiveConversationId(conv.id);
            syncConversationModes(conv);
          }
        } catch { /* ignore */ }
        setHistoryLoaded(true);
      }
    })();
  }, [conversationIdFromUrl, loadConversationMessages, loadConversations, syncConversationModes]);

  // ── Send ─────────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string, imgBase64?: string | null, modelOverride?: string) => {
    if ((!text.trim() && !imgBase64) || isStreaming) return;

    const convId = activeConvRef.current;
    const userMessage = text.trim() || (imgBase64 ? 'What can you tell me about this image?' : '');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      imagePreview: imgBase64 ? `data:image/jpeg;base64,${imgBase64}` : undefined,
    };
    const assistantMsgId = `assistant-${Date.now() + 1}`;
    const assistantMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '' };

    const history = messagesRef.current.slice(-10).map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg, assistantMsg]);
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
          model: modelOverride,
          manualModes,
        }),
      });

      if (response.status === 429) {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: 'Rate limit reached. Please wait a moment before sending another message.' } : m));
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
            const parsed = JSON.parse(raw) as {
              text?: string;
              books?: BookCitation[];
              error?: string;
              modeState?: ConversationModeState;
            };
            if (parsed.modeState) applyModeState(parsed.modeState);
            if (parsed.text) setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: m.content + parsed.text } : m));
            if (parsed.books) setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, citations: parsed.books } : m));
            if (parsed.error) setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: `Error: ${parsed.error}` } : m));
          } catch { /* ignore malformed chunks */ }
        }
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: 'Sorry, something went wrong. Please try again.' } : m));
    }

    setIsStreaming(false);
    const updatedConversations = await loadConversations();
    const activeConversation = updatedConversations.find(conv => conv.id === activeConvRef.current) ?? null;
    syncConversationModes(activeConversation);
  }, [applyModeState, isStreaming, loadConversations, manualModes, syncConversationModes]);

  // Bridge AssistantChatInput → sendMessage
  const handleChatSend = useCallback(async (payload: ChatSendPayload) => {
    let imgBase64: string | null = null;
    const imageFile = payload.files.find(f => f.type.startsWith('image/'));
    if (imageFile) {
      try { imgBase64 = await compressImage(imageFile.file); } catch { /* ignore */ }
    }
    const text = payload.pastedContent.length > 0
      ? `${payload.message}\n\n${payload.pastedContent.map(p => p.content).join('\n\n')}`
      : payload.message;
    await sendMessage(text, imgBase64, payload.model);
  }, [sendMessage]);

  const activeModes = resolveAiModes(manualModes, autoModes);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const currentIsStudySession = isStudySession || !!activeConversation?.studyBookId;
  const suggestions = getSuggestions(user?.role, user?.facultyName);
  const showSuggestions = historyLoaded && messages.length === 0 && !currentIsStudySession;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col gap-3 relative overflow-hidden">

      {/* Sidebar backdrop */}
      <div
        className={cn(
          'absolute inset-0 z-20 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div className={cn(
        'absolute inset-y-0 left-0 z-30 w-72 flex flex-col',
        'border-r border-gray-200 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/98',
        'transition-transform duration-300 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-white/10">
          <span className="text-sm font-semibold text-slate-900 dark:text-white/90">Chat History</span>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="border-b border-gray-200 px-3 py-3 dark:border-white/[0.06]">
          <button
            onClick={createNewChat}
            className="flex w-full items-center gap-2.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-500/30 dark:bg-primary-500/15 dark:text-primary-400 dark:hover:bg-primary-500/25"
          >
            <Plus className="w-4 h-4" />New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-slate-300 dark:text-white/20" />
              <p className="text-xs text-slate-400 dark:text-white/30">No conversations yet</p>
            </div>
          ) : conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              style={{ width: 'calc(100% - 8px)' }}
              className={cn(
                'group mx-1 flex w-full items-start justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors',
                conv.id === activeConversationId ? 'border-primary-200 bg-primary-50 text-slate-900 dark:border-primary-500/20 dark:bg-primary-500/15 dark:text-white' : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">{conv.title || 'New Chat'}</p>
                <p className={cn('mt-0.5 text-[11px]', conv.id === activeConversationId ? 'text-primary-700/80 dark:text-white/60' : 'text-slate-400 dark:text-white/35')}>{formatConvTime(conv.updatedAt)}</p>
              </div>
              <button
                onClick={e => handleDeleteConversation(conv.id, e)}
                disabled={deletingId === conv.id}
                className={cn(
                  'flex-shrink-0 p-1 rounded-lg transition-colors mt-0.5 opacity-0 group-hover:opacity-100',
                  'text-slate-400 hover:bg-red-50 hover:text-red-500 dark:text-white/30 dark:hover:bg-red-400/10 dark:hover:text-red-400',
                  conv.id === activeConversationId && 'opacity-40 group-hover:opacity-100',
                  deletingId === conv.id && 'opacity-100 animate-pulse',
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl border border-gray-200 dark:border-white/20 text-gray-500 dark:text-gray-400 hover:text-primary-500 hover:border-primary-500/40 transition-colors flex-shrink-0"
          title="Chat history"
        >
          <History className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/20 flex-shrink-0">
          <span className="text-white font-bold text-xs">OZ</span>
        </div>
        <div className="flex-1 min-w-0">
          {user && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Hello, <span className="font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
            </p>
          )}
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">OZ AI</h1>
        </div>
        <button
          onClick={createNewChat}
          disabled={isStreaming}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/20 text-gray-500 dark:text-gray-400 hover:text-primary-500 hover:border-primary-500/40 transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />New
        </button>
        {aiOnline !== null && (
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0',
            aiOnline
              ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          )}>
            {aiOnline ? '● OZ AI' : '● Offline'}
          </span>
        )}
      </div>

      {/* Mode selector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-0.5 flex-shrink-0">Modes:</span>
          {CHAT_MODES.map((mode) => {
            const isNormal = mode.value === 'normal';
            const aiMode = mode.value as AiMode;
            const isManual = !isNormal && manualModes.includes(aiMode);
            const isAuto = !isNormal && autoModes.includes(aiMode);
            const isActive = isNormal ? activeModes.length === 0 : activeModes.includes(aiMode);

            return (
              <button
                key={mode.value}
                onClick={() => void handleModeToggle(mode.value)}
                title={isManual ? 'Pinned manually' : isAuto ? 'Auto-selected by OZ' : 'Inactive'}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors border inline-flex items-center gap-1.5',
                  isManual
                    ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/15'
                    : isActive
                      ? 'bg-purple-500/12 text-purple-600 dark:text-purple-400 border-purple-500/35'
                      : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-purple-500/30 hover:text-purple-500 dark:hover:text-purple-400',
                )}
              >
                <span>{mode.label}</span>
                {isManual && <span className="text-[10px] uppercase tracking-wide opacity-80">Pin</span>}
                {!isManual && isAuto && <span className="text-[10px] uppercase tracking-wide opacity-70">Auto</span>}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          OZ can activate modes automatically while you chat. Click a mode to pin or unpin it manually.
        </p>
      </div>

      {/* Study session banner */}
      {currentIsStudySession && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl">
          <BookOpen className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Study Session</span>
          <span className="text-xs text-purple-500/60">— Your personalised study guide is ready below</span>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden flex flex-col min-h-0">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

          {/* Empty / suggestions state */}
          {showSuggestions && (
            <div className="h-full flex flex-col items-center justify-center gap-6 py-8">
              <div className="text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/20">
                  <span className="text-white font-bold text-lg">OZ</span>
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
                    onClick={async () => await sendMessage(q)}
                    className="text-left px-4 py-3 rounded-xl text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 hover:border-primary-500/50 hover:bg-primary-500/5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            return (
              <div key={msg.id} className={cn('flex gap-3 items-start', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                {/* Avatar */}
                {msg.role === 'assistant' ? (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white font-bold text-[10px]">OZ</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary-600 dark:text-primary-400 font-semibold text-xs">
                      {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                    </span>
                  </div>
                )}

                {/* Bubble */}
                <div className={cn(
                  'max-w-[78%] rounded-2xl px-4 py-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary-500/10 border border-primary-500/20 rounded-tr-sm text-gray-900 dark:text-gray-100'
                    : 'bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded-tl-sm text-gray-900 dark:text-gray-100',
                )}>
                  {msg.imagePreview && (
                    <img src={msg.imagePreview} alt="Attached" className="max-w-xs rounded-lg mb-2 border border-gray-200 dark:border-white/20" />
                  )}
                  {msg.role === 'assistant' ? (
                    <div className="leading-relaxed">
                      {renderMessage(msg.content)}
                      {msg.citations && msg.citations.length > 0 && <BookCitationCards citations={msg.citations} />}
                      {isStreaming && isLast && (
                        <span className="inline-block w-2 h-4 bg-primary-500 rounded-sm animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isStreaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-[10px]">OZ</span>
              </div>
              <div className="bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  {[0, 150, 300].map(delay => (
                    <span key={delay} className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Assistant input */}
        <div className="border-t border-gray-200 dark:border-white/[0.08] p-3">
          <AssistantChatInput
            onSendMessage={handleChatSend}
            disabled={isStreaming}
            placeholder={currentIsStudySession ? 'Ask about this book…' : 'Ask me anything about books…'}
          />
        </div>
      </div>
    </div>
  );
}











