'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send, Sparkles, User, Bot, Loader2, ImageIcon, X, BookOpen, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modelUsed?: string;
  sources?: string[];
  imagePreview?: string;
}

interface BookContext {
  id: string;
  title: string;
  authors: string[];
  category: string | null;
}

const DEPT_SUGGESTIONS: Record<string, string[]> = {
  engineering: [
    'Recommend books on algorithms and data structures',
    'What programming books do you have for beginners?',
    'Find me resources on software architecture',
    'How do I borrow or reserve a book?',
  ],
  science: [
    'Recommend books on mathematics and physics',
    'What science textbooks are available?',
    'Find resources on chemistry and biology',
    'How do I borrow or reserve a book?',
  ],
  medicine: [
    'Recommend medical textbooks for students',
    'Find books on anatomy and physiology',
    'What health sciences resources do you have?',
    'How do I borrow or reserve a book?',
  ],
  law: [
    'Recommend books on constitutional law',
    'Find resources on legal research and writing',
    'What law journals are in the catalog?',
    'How do I borrow or reserve a book?',
  ],
  business: [
    'Recommend books on economics and finance',
    'Find resources on business management',
    'What marketing and strategy books do you have?',
    'How do I borrow or reserve a book?',
  ],
  default: [
    'What books do you recommend for me?',
    'How do I borrow or reserve a book?',
    'What are the most popular books right now?',
    'Tell me about reading lists',
  ],
};

function getSuggestedQuestions(facultyName?: string | null): string[] {
  if (!facultyName) return DEPT_SUGGESTIONS.default;
  const f = facultyName.toLowerCase();
  if (f.includes('engineer') || f.includes('computer') || f.includes('software')) return DEPT_SUGGESTIONS.engineering;
  if (f.includes('natural science') || f.includes('physics') || f.includes('chemistry') || f.includes('math')) return DEPT_SUGGESTIONS.science;
  if (f.includes('medic') || f.includes('health') || f.includes('nurs') || f.includes('pharm')) return DEPT_SUGGESTIONS.medicine;
  if (f.includes('law') || f.includes('legal') || f.includes('hukuk')) return DEPT_SUGGESTIONS.law;
  if (f.includes('business') || f.includes('manag') || f.includes('econom') || f.includes('finance')) return DEPT_SUGGESTIONS.business;
  return DEPT_SUGGESTIONS.default;
}

// Minimal markdown renderer — handles bold, italic, inline code, links, bullet lists, numbered lists
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      nodes.push(<li key={key++} className="ml-4 list-disc">{inlineRender(line.slice(2))}</li>);
      continue;
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      nodes.push(<li key={key++} className="ml-4 list-decimal">{inlineRender(line.replace(/^\d+\.\s/, ''))}</li>);
      continue;
    }
    // Empty line
    if (line.trim() === '') {
      nodes.push(<br key={key++} />);
      continue;
    }
    nodes.push(<span key={key++} className="block">{inlineRender(line)}</span>);
  }
  return nodes;
}

function inlineRender(text: string): React.ReactNode {
  // Split on markdown patterns: **bold**, *italic*, `code`, [label](url)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*]+\*$/.test(part)) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (/^`[^`]+`$/.test(part)) {
      return <code key={i} className="px-1 py-0.5 bg-black/10 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isInternal = href.startsWith('/');
      if (isInternal) {
        return (
          <Link key={i} href={href} className="underline underline-offset-2 font-medium hover:opacity-80">
            {label}
          </Link>
        );
      }
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium hover:opacity-80 inline-flex items-center gap-0.5">
          {label}<ExternalLink className="w-3 h-3 inline" />
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
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
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataUrl.split(',')[1]); // return base64 only
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function AIAssistantPage() {
  const { user } = useAuth();
  const suggestedQuestions = getSuggestedQuestions(user?.facultyName);
  const searchParams = useSearchParams();
  const bookId = searchParams.get('book');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI library assistant. I can help you find books, get recommendations, answer questions about the library, and more. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [bookContext, setBookContext] = useState<BookContext | null>(null);
  const [bookContextDismissed, setBookContextDismissed] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ base64: string; preview: string } | null>(null);
  const [contextSent, setContextSent] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch AI status
  useEffect(() => {
    aiApi.getStatus().then((s) => setAiOnline(s.available)).catch(() => setAiOnline(false));
  }, []);

  // Fetch book context if ?book= param present
  useEffect(() => {
    if (!bookId) return;
    fetch(`/api/books/${bookId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setBookContext({ id: data.id, title: data.title, authors: data.authors ?? [], category: data.category });
      })
      .catch(() => null);
  }, [bookId]);

  // Auto-send book context message once book is loaded
  useEffect(() => {
    if (!bookContext || contextSent) return;
    setContextSent(true);
    const authorsStr = bookContext.authors.length > 0 ? ` by ${bookContext.authors.join(', ')}` : '';
    const firstMsg = `I'm looking at "${bookContext.title}"${authorsStr}${bookContext.category ? ` (${bookContext.category})` : ''}. Can you give me a study guide and recommend related books?`;
    sendMessage(firstMsg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string, image?: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
      imagePreview: image ? `data:image/jpeg;base64,${image}` : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
    setIsLoading(true);

    try {
      const data = await aiApi.chat({ message: text.trim(), image });
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply,
          modelUsed: data.modelUsed,
          sources: data.sources,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleSend = () => {
    if (!input.trim() && !pendingImage) return;
    const text = input.trim() || (pendingImage ? 'What can you tell me about this image?' : '');
    sendMessage(text, pendingImage?.base64);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const base64 = await compressImage(file);
      const preview = `data:image/jpeg;base64,${base64}`;
      setPendingImage({ base64, preview });
      inputRef.current?.focus();
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Library Assistant</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Personalized book recommendations &amp; library help</p>
        </div>
        {aiOnline !== null && (
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold',
            aiOnline
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          )}>
            {aiOnline ? '● AI Online' : '● Basic Mode'}
          </span>
        )}
      </div>

      {/* Book context banner */}
      {bookContext && !bookContextDismissed && (
        <div className="flex items-start gap-3 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
          <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-purple-800 dark:text-purple-300 font-medium truncate">
              Study help for: <Link href={`/dashboard/catalog/${bookContext.id}`} className="underline underline-offset-2 hover:text-purple-600">{bookContext.title}</Link>
            </p>
            {bookContext.authors.length > 0 && (
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">{bookContext.authors.join(', ')}</p>
            )}
          </div>
          <button onClick={() => setBookContextDismissed(true)} className="text-purple-400 hover:text-purple-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat container */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col shadow-sm">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={cn('flex gap-2.5', message.role === 'user' ? 'flex-row-reverse' : '')}>
              {/* Avatar */}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                message.role === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900 dark:to-violet-900 text-purple-600 dark:text-purple-300'
              )}>
                {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Bubble */}
              <div className={cn(
                'max-w-[78%] rounded-2xl px-4 py-3 text-sm',
                message.role === 'user'
                  ? 'bg-primary-500 text-white rounded-tr-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'
              )}>
                {/* Image preview (user message) */}
                {message.imagePreview && (
                  <img src={message.imagePreview} alt="Uploaded" className="max-w-xs rounded-lg mb-2 border border-white/20" />
                )}
                {/* Content */}
                <div className={cn('leading-relaxed', message.role === 'assistant' ? 'prose-sm' : '')}>
                  {message.role === 'assistant'
                    ? renderMarkdown(message.content)
                    : message.content}
                </div>

                {/* Source pills */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pt-1 border-t border-gray-200 dark:border-gray-700">
                    {message.sources.map((src) => (
                      <Link
                        key={src}
                        href={src}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-xs hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {src.split('/').pop() || 'catalog'}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Timestamp + model */}
                <div className={cn('flex items-center gap-2 mt-1.5', message.role === 'user' ? 'text-white/60' : 'text-gray-400 dark:text-gray-500')}>
                  <span className="text-[11px]">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {message.role === 'assistant' && message.modelUsed && (
                    <span className="text-[10px] font-mono">{message.modelUsed}</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900 dark:to-violet-900 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested questions — only on first message */}
        {messages.length === 1 && !bookId && (
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Suggested questions</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300 rounded-full text-sm text-gray-600 dark:text-gray-400 transition-colors border border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image preview strip */}
        {pendingImage && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <div className="relative inline-block">
              <img src={pendingImage.preview} alt="To send" className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Image ready to send</span>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
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
              disabled={isLoading}
              title="Attach image"
              className={cn(
                'p-2.5 rounded-xl border transition-colors flex-shrink-0',
                pendingImage
                  ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:text-purple-500 hover:border-purple-300 dark:hover:border-purple-700',
                isLoading && 'opacity-40 cursor-not-allowed'
              )}
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={pendingImage ? 'Ask about this image...' : 'Ask me anything about books...'}
              className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm placeholder:text-gray-400 dark:text-gray-200"
              disabled={isLoading}
            />

            <button
              onClick={handleSend}
              disabled={(!input.trim() && !pendingImage) || isLoading}
              className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-purple-500/20 flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
