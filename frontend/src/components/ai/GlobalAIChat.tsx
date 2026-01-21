'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { GripVertical, MessageSquare, Send, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button, Input } from '@/components/ui';
import { useGuestAISession } from '@/hooks/useGuestAISession';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Position = { x: number; y: number };

type AIContext = 'marketing' | 'business';

const MOBILE_NAV_HEIGHT = 64;
const MOBILE_NAV_CLEARANCE = MOBILE_NAV_HEIGHT + 5;

export function GlobalAIChat() {
  const { isAuthenticated, isInitialized, fetchUser } = useAuthStore();
  const pathname = usePathname();

  // Determine AI context based on authentication status
  const aiContext: AIContext = isAuthenticated ? 'business' : 'marketing';
  
  // Guest session management for marketing context
  const guestSession = useGuestAISession();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [size] = useState<{ width: number; height: number }>({ width: 480, height: 640 });

  // Draggable state
  const [position, setPosition] = useState<Position>({ x: 16, y: MOBILE_NAV_CLEARANCE }); // bottom offset clears mobile nav
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const dragSourceRect = useRef<DOMRect | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const endRef = useRef<HTMLDivElement>(null);

  // For marketing context, we don't require authentication but check rate limits
  // For business context, require authentication
  const canUseChat = aiContext === 'marketing' 
    ? guestSession.canSendMessage 
    : (isInitialized && isAuthenticated);

  // Drag handlers (only for the floating widget, not the modal)
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const activeRect = triggerRef.current?.getBoundingClientRect() ?? null;
    dragSourceRect.current = activeRect;
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
        y: Math.max(MOBILE_NAV_CLEARANCE, Math.min(newY, window.innerHeight - rect.height - 8)),
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
    if (aiContext === 'marketing') {
      return 'Ask about BizPilot features, pricing, or how it can help your business...';
    }
    return 'Ask about sales, inventory, pricing, or customers...';
  }, [aiContext]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    // Check rate limits for marketing context
    if (aiContext === 'marketing' && !guestSession.canSendMessage) {
      const rateLimitMessage = guestSession.rateLimitMessage;
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant-rate-limit`,
        role: 'assistant',
        content: rateLimitMessage || 'You have reached the message limit. Please try again later or sign up for unlimited access.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }

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

    // Track analytics for guest sessions
    if (aiContext === 'marketing') {
      guestSession.trackAnalytics('message_sent', {
        messageLength: trimmed.length,
        conversationLength: messages.length + 1
      });
    }

    try {
      let response;
      
      if (aiContext === 'marketing') {
        // For marketing context, use guest AI endpoint with session ID
        response = await apiClient.post('/ai/guest-chat', {
          message: trimmed,
          conversation_id: conversationId,
          session_id: guestSession.session?.id,
        });
      } else {
        // For business context, use authenticated AI endpoint
        response = await apiClient.post('/ai/chat', {
          message: trimmed,
          conversation_id: conversationId,
        });
      }

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
      
      // Update session activity for marketing context
      if (aiContext === 'marketing') {
        guestSession.updateSessionActivity();
        guestSession.trackAnalytics('message_received', {
          responseLength: assistantMessage.content.length,
          conversationLength: messages.length + 2
        });
      }
    } catch (error) {
      let errorMessage = 'Unable to process that right now. Please try again.';
      
      // Provide context-specific error messages
      if (aiContext === 'marketing') {
        errorMessage = 'Sorry, I\'m having trouble right now. For immediate help, please contact our sales team at sales@bizpilot.co.za or try our free Pilot Solo tier.';
        guestSession.trackAnalytics('message_error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant-error`,
        role: 'assistant',
        content: errorMessage,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  };

  // Clamp modal position to viewport when opened/resized so it stays fully visible
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const viewportPadding = 12;
    const headerFooterAllowance = 80; // leave a buffer so input/footer stays visible
    const width = Math.min(size.width, window.innerWidth - viewportPadding * 2);
    const height = Math.min(size.height, window.innerHeight - headerFooterAllowance - viewportPadding * 2);
    setPosition((prev) => ({
      x: Math.max(viewportPadding, Math.min(prev.x, window.innerWidth - width - viewportPadding)),
      y: Math.max(MOBILE_NAV_CLEARANCE, Math.min(prev.y, window.innerHeight - height - viewportPadding)),
    }));
  }, [open, size.height, size.width]);

  // Re-clamp on window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      if (!open) return;
      const viewportPadding = 12;
      const headerFooterAllowance = 80;
      const width = Math.min(size.width, window.innerWidth - viewportPadding * 2);
      const height = Math.min(size.height, window.innerHeight - headerFooterAllowance - viewportPadding * 2);
      setPosition((prev) => ({
        x: Math.max(viewportPadding, Math.min(prev.x, window.innerWidth - width - viewportPadding)),
        y: Math.max(MOBILE_NAV_CLEARANCE, Math.min(prev.y, window.innerHeight - height - viewportPadding)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open, size.height, size.width]);

  // Hide global chat on /ai route (full AI page already provides chat)
  if (pathname?.startsWith('/ai')) {
    return null;
  }

  // For marketing context, show on marketing pages even without authentication
  // For business context, require authentication
  if (aiContext === 'business' && !canUseChat) {
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
          ref={overlayRef}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        >
          <div
            ref={chatRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              right: position.x,
              bottom: position.y,
              width: typeof window !== 'undefined' ? Math.min(size.width, window.innerWidth - 24) : size.width,
              height:
                typeof window !== 'undefined'
                  ? Math.min(size.height, window.innerHeight - 72)
                  : size.height,
              maxHeight: typeof window !== 'undefined' ? window.innerHeight - 16 : undefined,
              maxWidth: typeof window !== 'undefined' ? window.innerWidth - 16 : undefined,
              minHeight: 240,
            }}
            className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl resize-y"
          >
            {/* Header (sticky) */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950">
              <div className="flex items-center gap-2 select-none">
                <GripVertical className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-white">
                  {aiContext === 'marketing' ? 'BizPilot Assistant' : 'AI Assistant'}
                </span>
                {aiContext === 'marketing' && (
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    Guest
                  </span>
                )}
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

            <div className="flex h-full min-h-0 flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
                {messages.length === 0 ? (
                  <div className="text-sm text-slate-400">
                    {aiContext === 'marketing' 
                      ? 'Hi! I can help you learn about BizPilot features, pricing, and how it can benefit your business. What would you like to know?'
                      : 'Ask me anything about your business.'
                    }
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pb-2">
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
                    {isSending && (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                        Thinking...
                      </div>
                    )}
                    <div ref={endRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 px-3 py-3 bg-slate-950">
                {/* Rate limit indicator for marketing context */}
                {aiContext === 'marketing' && guestSession.session && (
                  <div className="mb-2 text-xs text-slate-400">
                    Messages remaining: {guestSession.messagesRemaining} / {20}
                    {guestSession.messagesRemaining <= 5 && (
                      <span className="text-yellow-400 ml-2">
                        Sign up for unlimited messages!
                      </span>
                    )}
                  </div>
                )}
                
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
                    disabled={isSending || !canUseChat}
                  />
                  <Button
                    type="button"
                    onClick={sendMessage}
                    disabled={isSending || input.trim().length === 0 || !canUseChat}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
