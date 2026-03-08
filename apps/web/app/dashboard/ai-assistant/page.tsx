'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modelUsed?: string;
  sources?: string[];
}

const suggestedQuestions = [
  "What books do you recommend for learning algorithms?",
  "Can you help me find books about psychology?",
  "How do I borrow or reserve a book?",
  "Tell me about reading lists",
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: "Hello! I'm your AI library assistant. I can help you find books, get recommendations based on your interests, answer questions about the library, and more. How can I help you today?", timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    const text = input.trim();
    setInput('');
    setIsLoading(true);
    try {
      const data = await aiApi.chat({ message: text });
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        modelUsed: data.modelUsed,
        sources: data.sources,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI Library Assistant</h1>
          <p className="text-sm text-gray-500">Get personalized book recommendations and help</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={cn('flex gap-3', message.role === 'user' ? 'flex-row-reverse' : '')}>
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', message.role === 'user' ? 'bg-primary-500 text-white' : 'bg-purple-100 text-purple-600')}>
                {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn('max-w-[80%] rounded-2xl px-4 py-3', message.role === 'user' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-800')}>
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.sources.map((src) => (
                      <a
                        key={src}
                        href={src}
                        className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 transition-colors"
                      >
                        {src.split('/').pop()}
                      </a>
                    ))}
                  </div>
                )}
                <div className={cn('flex items-center gap-2 mt-1', message.role === 'user' ? 'text-primary-100' : 'text-gray-400')}>
                  <span className="text-xs">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {message.role === 'assistant' && (
                    <span className="text-[10px]">{message.modelUsed || 'unknown'}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question, index) => (
                <button key={index} onClick={() => setInput(question)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-600 transition-colors">
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything about books..."
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              disabled={isLoading}
            />
            <button onClick={handleSend} disabled={!input.trim() || isLoading} className="px-4 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
