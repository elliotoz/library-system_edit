'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, ChevronDown, ArrowUp, X, FileText, Loader2, Check, Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AUTO_MODEL_ID, AUTO_ONLY_MODEL_OPTIONS, type AiModelOption } from '@/lib/ai-models';

/* ── Icons ── */
const ThinkingIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 9.72386 2.72386 9.5 3 9.5C3.27614 9.5 3.5 9.72386 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977ZM10 5.5C10.2761 5.5 10.5 5.72386 10.5 6V9.69043L13.2236 11.0527C13.4706 11.1762 13.5708 11.4766 13.4473 11.7236C13.3392 11.9397 13.0957 12.0435 12.8711 11.9834L12.7764 11.9473L9.77637 10.4473C9.60698 10.3626 9.5 10.1894 9.5 10V6C9.5 5.72386 9.72386 5.5 10 5.5ZM3.66211 6.94141C4.0273 6.94159 4.32303 7.23735 4.32324 7.60254C4.32324 7.96791 4.02743 8.26446 3.66211 8.26465C3.29663 8.26465 3 7.96802 3 7.60254C3.00021 7.23723 3.29676 6.94141 3.66211 6.94141ZM4.95605 4.29395C5.32146 4.29404 5.61719 4.59063 5.61719 4.95605C5.6171 5.3214 5.3214 5.61709 4.95605 5.61719C4.59063 5.61719 4.29403 5.32146 4.29395 4.95605C4.29395 4.59057 4.59057 4.29395 4.95605 4.29395ZM7.60254 3C7.96802 3 8.26465 3.29663 8.26465 3.66211C8.26446 4.02743 7.96791 4.32324 7.60254 4.32324C7.23736 4.32302 6.94159 4.0273 6.94141 3.66211C6.94141 3.29676 7.23724 3.00022 7.60254 3Z" />
  </svg>
);

/* ── Types ── */
export interface AttachedFile {
  id: string;
  file: File;
  type: string;
  preview: string | null;
  uploadStatus: 'pending' | 'uploading' | 'complete';
  content?: string;
}

interface PastedSnippet {
  id: string;
  content: string;
  timestamp: Date;
}

/* ── Utils ── */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/* ── File Preview Card ── */
const FilePreviewCard = ({ file, onRemove }: { file: AttachedFile; onRemove: (id: string) => void }) => {
  const isImage = file.type.startsWith('image/') && file.preview;
  return (
    <div className="relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-bg-300 bg-bg-200 transition-all hover:border-text-400">
      {isImage ? (
        <div className="w-full h-full relative">
          <img src={file.preview!} alt={file.file.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
        </div>
      ) : (
        <div className="w-full h-full p-3 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-bg-300 rounded">
              <FileText className="w-4 h-4 text-text-300" />
            </div>
            <span className="text-[10px] font-medium text-text-400 uppercase tracking-wider truncate">
              {file.file.name.split('.').pop()}
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-text-200 truncate" title={file.file.name}>{file.file.name}</p>
            <p className="text-[10px] text-text-500">{formatFileSize(file.file.size)}</p>
          </div>
        </div>
      )}
      <button
        onClick={() => onRemove(file.id)}
        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
      {file.uploadStatus === 'uploading' && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
      )}
    </div>
  );
};

/* ── Pasted Content Card ── */
const PastedContentCard = ({ content, onRemove }: { content: PastedSnippet; onRemove: (id: string) => void }) => (
  <div className="relative group flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden border border-bg-300 bg-bg-100 p-3 flex flex-col justify-between shadow-sm">
    <div className="overflow-hidden w-full">
      <p className="text-[10px] text-text-400 leading-[1.4] font-mono break-words whitespace-pre-wrap line-clamp-4 select-none">
        {content.content}
      </p>
    </div>
    <div className="flex items-center justify-between w-full mt-2">
      <div className="inline-flex items-center justify-center px-1.5 py-[2px] rounded border border-bg-300">
        <span className="text-[9px] font-bold text-text-300 uppercase tracking-wider">PASTED</span>
      </div>
    </div>
    <button
      onClick={() => onRemove(content.id)}
      className="absolute top-2 right-2 p-[3px] bg-bg-100 border border-bg-300 rounded-full text-text-400 hover:text-text-200 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
    >
      <X className="w-2 h-2" />
    </button>
  </div>
);

/* ── Model Selector ── */
const ModelSelector = ({ models, selectedModel, onSelect }: {
  models: AiModelOption[];
  selectedModel: string;
  onSelect: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = models.find(m => m.id === selectedModel) ?? models[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-1 h-8 rounded-xl px-2.5 text-xs font-medium transition-colors duration-200 active:scale-[0.98] whitespace-nowrap',
          isOpen
            ? 'bg-bg-200 text-text-100'
            : 'text-text-300 hover:text-text-200 hover:bg-bg-200',
        )}
      >
        {current.name}
        <ChevronDown className={cn('w-4 h-4 opacity-75 transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-bg-100 border border-bg-300 rounded-2xl shadow-xl overflow-hidden z-50 p-1.5">
          {models.map(model => (
            <button
              key={model.id}
              onClick={() => { onSelect(model.id); setIsOpen(false); }}
              className="w-full text-left px-3 py-2.5 rounded-xl flex items-start justify-between hover:bg-bg-200 transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-100">{model.name}</span>
                  {model.badge && (
                    <span className="px-1.5 py-[1px] rounded-full text-[10px] font-medium border border-bg-300 text-text-300">
                      {model.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-text-300">{model.description}</span>
              </div>
              {selectedModel === model.id && <Check className="w-4 h-4 text-primary-500 mt-1 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main Component ── */
export interface ChatSendPayload {
  message: string;
  files: AttachedFile[];
  pastedContent: PastedSnippet[];
  model: string;
  isThinkingEnabled: boolean;
}

interface AssistantChatInputProps {
  onSendMessage: (payload: ChatSendPayload) => void;
  disabled?: boolean;
  placeholder?: string;
  selectedModel?: string;
  onSelectedModelChange?: (model: string) => void;
  models?: AiModelOption[];
}

export const AssistantChatInput: React.FC<AssistantChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Ask me anything about books…',
  selectedModel = AUTO_MODEL_ID,
  onSelectedModelChange,
  models,
}) => {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [pastedContent, setPastedContent] = useState<PastedSnippet[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  const modelOptions = models && models.length > 0 ? models : AUTO_ONLY_MODEL_OPTIONS;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 384) + 'px';
  }, [message]);

  const handleFiles = useCallback((list: FileList | File[]) => {
    const newFiles: AttachedFile[] = Array.from(list).map(file => {
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
      return {
        id: Math.random().toString(36).slice(2, 11),
        file,
        type: isImage ? 'image/unknown' : (file.type || 'application/octet-stream'),
        preview: isImage ? URL.createObjectURL(file) : null,
        uploadStatus: 'pending' as const,
      };
    });
    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      setTimeout(() => {
        setFiles(prev => prev.map(p => p.id === f.id ? { ...p, uploadStatus: 'complete' as const } : p));
      }, 800 + Math.random() * 700);
    });
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedFiles: File[] = [];
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      if (e.clipboardData.items[i].kind === 'file') {
        const f = e.clipboardData.items[i].getAsFile();
        if (f) pastedFiles.push(f);
      }
    }
    if (pastedFiles.length > 0) { e.preventDefault(); handleFiles(pastedFiles); return; }
    const text = e.clipboardData.getData('text');
    if (text.length > 300) {
      e.preventDefault();
      setPastedContent(prev => [...prev, { id: Math.random().toString(36).slice(2, 11), content: text, timestamp: new Date() }]);
    }
  };

  const handleSend = () => {
    if (disabled || (!message.trim() && files.length === 0 && pastedContent.length === 0)) return;
    onSendMessage({ message, files, pastedContent, model: selectedModel, isThinkingEnabled });
    setMessage('');
    setFiles([]);
    setPastedContent([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const hasContent = !disabled && (!!message.trim() || files.length > 0 || pastedContent.length > 0);

  return (
    <div
      className="relative w-full"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
    >
      <div className={cn(
        'flex flex-col border border-bg-300 rounded-2xl bg-bg-100 shadow-sm transition-shadow duration-200',
        'hover:shadow-md focus-within:shadow-md',
        disabled && 'opacity-60 pointer-events-none',
      )}>
        <div className="flex flex-col px-3 pt-3 pb-2 gap-2">

          {/* Attached files / pastes */}
          {(files.length > 0 || pastedContent.length > 0) && (
            <div className="flex gap-3 overflow-x-auto pb-2 px-1">
              {pastedContent.map(c => (
                <PastedContentCard key={c.id} content={c} onRemove={id => setPastedContent(prev => prev.filter(x => x.id !== id))} />
              ))}
              {files.map(f => (
                <FilePreviewCard key={f.id} file={f} onRemove={id => setFiles(prev => prev.filter(x => x.id !== id))} />
              ))}
            </div>
          )}

          {/* Textarea */}
          <div className="max-h-96 overflow-y-auto min-h-[2.5rem] pl-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="w-full bg-transparent border-0 outline-none text-text-100 text-[15px] placeholder:text-text-400 resize-none overflow-hidden py-0 leading-relaxed font-normal"
              style={{ minHeight: '1.5em' }}
            />
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2">
            {/* Left */}
            <div className="flex items-center gap-1 flex-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                type="button"
                aria-label="Attach file"
                className="h-8 w-8 flex items-center justify-center rounded-lg text-text-400 hover:text-text-200 hover:bg-bg-200 transition-colors active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                type="button"
                aria-label="Extended thinking"
                aria-pressed={isThinkingEnabled}
                className={cn(
                  'h-8 w-8 flex items-center justify-center rounded-lg transition-colors active:scale-95',
                  isThinkingEnabled
                    ? 'text-primary-500 bg-primary-500/10'
                    : 'text-text-400 hover:text-text-200 hover:bg-bg-200',
                )}
              >
                <ThinkingIcon />
              </button>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1">
              <ModelSelector models={modelOptions} selectedModel={selectedModel} onSelect={(modelId) => onSelectedModelChange?.(modelId)} />
              <button
                onClick={handleSend}
                disabled={!hasContent}
                type="button"
                aria-label="Send message"
                className={cn(
                  'h-8 w-8 flex items-center justify-center rounded-xl transition-colors active:scale-95',
                  hasContent
                    ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm'
                    : 'bg-primary-500/30 text-white/60 cursor-default',
                )}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-bg-200/90 border-2 border-dashed border-primary-500 rounded-2xl z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
          <Archive className="w-10 h-10 text-primary-500 mb-2 animate-bounce" />
          <p className="text-primary-500 font-medium text-sm">Drop files to attach</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
};

export default AssistantChatInput;




