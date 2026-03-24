/**
 * TenderLineRow.tsx — Single payment row in the payment summary
 */

'use client';

import { motion } from 'framer-motion';
import { X, Banknote, CreditCard, Landmark } from 'lucide-react';
import { TenderLine } from '../types';

interface TenderLineRowProps {
  line: TenderLine;
  onRemove: (id: string) => void;
}

const ICONS = {
  cash: Banknote,
  card: CreditCard,
  eft: Landmark,
  split: Banknote, // Should not happen for line
};

export function TenderLineRow({ line, onRemove }: TenderLineRowProps) {
  const Icon = ICONS[line.method_type] || Banknote;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-4 rounded-2xl border border-gray-700/30 bg-gray-800/20 p-4 backdrop-blur-sm"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900/50 text-gray-400">
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-100">{line.method_name}</p>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{line.method_type}</p>
      </div>

      <div className="text-right">
        <p className="text-lg font-black text-white">
          <span className="mr-0.5 text-xs font-medium text-blue-400 tracking-tighter">R</span>
          {line.amount.toFixed(2)}
        </p>
      </div>

      <button
        onClick={() => onRemove(line.id)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
