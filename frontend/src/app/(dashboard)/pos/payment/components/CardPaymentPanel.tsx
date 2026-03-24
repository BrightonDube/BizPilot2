/**
 * CardPaymentPanel.tsx — Card payment confirmation
 */

'use client';

import { motion } from 'framer-motion';
import { CreditCard, ChevronRight } from 'lucide-react';

interface CardPaymentPanelProps {
  balanceRemaining: number;
  onAddTender: (amount: number) => void;
  onCancel: () => void;
}

export function CardPaymentPanel({
  balanceRemaining,
  onAddTender,
  onCancel,
}: CardPaymentPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-6 rounded-3xl border border-gray-700/50 bg-gray-900/60 p-8 backdrop-blur-2xl shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CreditCard className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider">Card Payment</h2>
        </div>
        <button
          onClick={onCancel}
          className="text-sm font-bold text-gray-500 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="mb-2 text-sm font-bold text-gray-400 uppercase tracking-widest">Amount to Charge</p>
        <p className="text-5xl font-black text-white">R{balanceRemaining.toFixed(2)}</p>
        <p className="mt-4 text-sm text-gray-500 max-w-[200px]">Ensure the card terminal is ready before proceeding.</p>
      </div>

      <motion.button
        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onAddTender(balanceRemaining)}
        className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-lg font-black text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-blue-400"
      >
        <span>Confirm Card Payment</span>
        <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
      </motion.button>
    </motion.div>
  );
}
