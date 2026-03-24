/**
 * InventorySummaryCard.tsx — Display key inventory metrics
 */

'use client';

import { motion } from 'framer-motion';
import { Package, AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';
import { InventorySummary } from '../types';

interface InventorySummaryCardProps {
  summary: InventorySummary;
}

export function InventorySummaryCard({ summary }: InventorySummaryCardProps) {
  const cards = [
    { label: 'Total Items', value: summary.total_items, icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Total Value', value: `R${summary.total_value.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Low Stock', value: summary.low_stock_count, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Out of Stock', value: summary.out_of_stock_count, icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="rounded-3xl border border-gray-700/50 bg-gray-900/60 p-6 backdrop-blur-xl"
        >
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.bg} ${card.color} border border-current/20`}>
              <card.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-500">{card.label}</p>
              <p className="text-2xl font-black text-white">{card.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
