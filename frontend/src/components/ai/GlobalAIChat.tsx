'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, MessageSquare, Send, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button, Input } from '@/components/ui';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Position = { x: number; y: number };

export function GlobalAIChat() {
  const { isAuthenticated, isInitialized, fetchUser } = useAuthStore();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Draggable state
  const [position, setPosition] = useState<Position>({ x: 24, y: 96 }); // bottom-right offset, above bottom tab bar
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const dragSourceRect = useRef<DOMRect | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const endRef = useRef<HTMLDivElement>(null);

  const canUseChat = isInitialized && isAuthenticated;

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const activeRect = open ? chatRef.current?.getBoundingClientRect() : triggerRef.current?.getBoundingClientRect();
    dragSourceRect.current = activeRect ?? null;
    if (activeRect) {
      dragOffset.current = {
        x: clientX - activeRect.left,
        y: clientY - activeRect.top,
      };
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const rect = dragSourceRect.current ?? chatRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Calculate new position (from bottom-right corner)
      const newX = window.innerWidth - clientX - (rect.width - dragOffset.current.x);
      const newY = window.innerHeight - clientY - (rect.height - dragOffset.current.y);

      // Clamp to viewport
      setPosition({
        x: Math.max(8, Math.min(newX, window.innerWidth - rect.width - 8)),
        y: Math.max(8, Math.min(newY, window.innerHeight - rect.height - 8)),
      });
    };

    const handleEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isInitialized) {
      fetchUser();
    }
  }, [fetchUser, isInitialized]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages.length]);

  const placeholder = useMemo(() => {
    return 'Ask about sales, inventory, pricing, or customers...';
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    if (!canUseChat) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await apiClient.post('/ai/chat', {
        message: trimmed,
        conversation_id: conversationId,
      });

      const returnedConversationId = response.data?.conversation_id;
      if (typeof returnedConversationId === 'string' && returnedConversationId.length > 0) {
        setConversationId(returnedConversationId);
      }

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: String(response.data?.response ?? ''),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant-error`,
        role: 'assistant',
        content: 'Unable to process that right now. Please try again.',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  };

  if (!canUseChat) {
    return null;
  }

  return (
    <>
      {/* Floating trigger button - also draggable when chat is closed */}
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{ right: position.x, bottom: position.y }}
          className="fixed z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30 hover:from-purple-700 hover:to-blue-700 cursor-pointer"
          aria-label="Open AI Chat"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {open && (
        <div
          ref={chatRef}
          style={{ right: position.x, bottom: position.y }}
          className={`fixed z-50 w-[min(420px,calc(100vw-3rem))] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl ${isDragging ? 'cursor-grabbing select-none' : ''}`}
        >
          {/* Drag handle header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
            >
              <GripVertical className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-white">AI Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="text-sm text-slate-400">
                Ask me anything about your business.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900 text-slate-100 border border-slate-800'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 px-3 py-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                className="bg-slate-900 border-slate-700"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isSending}
              />
              <Button
                type="button"
                onClick={sendMessage}
                disabled={isSending || input.trim().length === 0}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
