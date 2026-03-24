/**
 * EFTPaymentPanel.tsx — EFT / Bank Transfer payment
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, ChevronRight } from 'lucide-react';

interface EFTPaymentPanelProps {
  balanceRemaining: number;
  onAddTender: (amount: number, reference?: string) => void;
  onCancel: () => void;
}

export function EFTPaymentPanel({
  balanceRemaining,
  onAddTender,
  onCancel,
}: EFTPaymentPanelProps) {
  const [reference, setReference] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-6 rounded-3xl border border-gray-700/50 bg-gray-900/60 p-8 backdrop-blur-2xl shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Landmark className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider">EFT Transfer</h2>
        </div>
        <button
          onClick={onCancel}
          className="text-sm font-bold text-gray-500 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Reference (Optional)</label>
        <input
          autoFocus
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. INV-1234"
          className="w-full rounded-2xl border border-gray-700/50 bg-gray-800/40 py-4 px-6 text-xl font-bold text-white outline-none ring-blue-500/50 transition-all focus:ring-4"
        />
      </div>

      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="mb-1 text-xs font-bold text-gray-400 uppercase tracking-widest">Amount to Transfer</p>
        <p className="text-4xl font-black text-white">R{balanceRemaining.toFixed(2)}</p>
      </div>

      <motion.button
        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onAddTender(balanceRemaining, reference)}
        className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 py-4 text-lg font-black text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-500 hover:to-purple-400"
      >
        <span>Confirm EFT Payment</span>
        <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
      </motion.button>
    </motion.div>
  );
}
