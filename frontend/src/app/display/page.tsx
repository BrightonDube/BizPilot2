/**
 * page.tsx — Standalone Customer Display
 * Polling for session updates from the POS.
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ShoppingBag, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface DisplaySessionItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface DisplaySessionTotals {
  subtotal: number;
  tax: number;
  total: number;
}

interface DisplaySession {
  items: DisplaySessionItem[];
  totals: DisplaySessionTotals;
}

export default function CustomerDisplayPage() {
  const searchParams = useSearchParams();
  const displayId = searchParams.get('id');
  
  const [session, setSession] = useState<DisplaySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!displayId) return;

    const pollSession = async () => {
      try {
        const response = await apiClient.get(`/displays/${displayId}/session`);
        setSession(response.data);
      } catch (err) {
        console.error('Polling error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    pollSession();
    const interval = setInterval(pollSession, 2000); // 2s polling
    return () => clearInterval(interval);
  }, [displayId]);

  if (!displayId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0c] text-white">
        <p className="text-xl font-black uppercase tracking-widest text-gray-500">No Display ID Provided</p>
      </div>
    );
  }

  if (isLoading && !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0c]">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!session || !session.items || session.items.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0c] p-10 text-center">
        <motion.div
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="mb-8 flex h-32 w-32 items-center justify-center rounded-[40px] bg-blue-500/10 text-blue-500"
        >
          <ShoppingBag className="h-16 w-16" />
        </motion.div>
        <h1 className="text-5xl font-black text-white uppercase tracking-tighter">Welcome to BizPilot</h1>
        <p className="mt-4 text-xl font-medium text-gray-500 uppercase tracking-[0.4em]">Please place your order</p>
      </div>
    );
  }

  return (
    <div className="grid h-screen grid-cols-1 lg:grid-cols-[1fr_450px] bg-[#0a0a0c] text-white">
      <main className="p-12 overflow-y-auto no-scrollbar">
        <div className="mb-10 flex items-center justify-between">
          <h2 className="text-4xl font-black uppercase tracking-tighter">Your <span className="text-blue-500">Order</span></h2>
          <span className="rounded-2xl bg-gray-800 px-6 py-2 text-sm font-black uppercase tracking-widest">{session.items.length} Items</span>
        </div>

        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {session.items.map((item: DisplaySessionItem) => (
              <motion.div
                key={item.id}
                layout
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                className="flex items-center justify-between rounded-3xl border border-gray-700/30 bg-gray-900/40 p-6"
              >
                <div className="flex items-center gap-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                    <Package className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">{item.name}</h3>
                    <p className="text-lg font-bold text-gray-500">QTY: {item.quantity} × R{item.price.toFixed(2)}</p>
                  </div>
                </div>
                <p className="text-3xl font-black text-white">R{(item.quantity * item.price).toFixed(2)}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      <aside className="flex flex-col justify-end border-l border-gray-700/50 bg-gray-900/60 p-12 backdrop-blur-3xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xl font-bold text-gray-500">
            <span>Subtotal</span>
            <span>R{session.totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xl font-bold text-gray-500">
            <span>Tax (15%)</span>
            <span>R{session.totals.tax.toFixed(2)}</span>
          </div>
          <div className="h-px bg-gray-700/50" />
          <div className="flex items-center justify-between text-6xl font-black text-white">
            <span>Total</span>
            <span className="text-blue-500">R{session.totals.total.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="mt-12 rounded-3xl bg-blue-600/10 border border-blue-600/20 p-8 text-center">
            <p className="text-sm font-black text-blue-400 uppercase tracking-[0.3em] mb-2">Thank you for shopping</p>
            <p className="text-xs text-gray-500 font-medium">BizPilot Pro • Premium POS Experience</p>
        </div>
      </aside>
    </div>
  );
}
