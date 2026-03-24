/**
 * StockItemTable.tsx — Detailed list of inventory items
 */

'use client';

import { motion } from 'framer-motion';
import { Edit3 } from 'lucide-react';
import { StockItem } from '../types';

interface StockItemTableProps {
  items: StockItem[];
  onAdjust: (item: StockItem) => void;
}

export function StockItemTable({ items, onAdjust }: StockItemTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-700/50 bg-gray-900/60 backdrop-blur-xl shadow-2xl">
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-700/50 bg-gray-800/30 text-xs font-black uppercase tracking-widest text-gray-500">
              <th className="px-6 py-5">Product / SKU</th>
              <th className="px-6 py-5">Location</th>
              <th className="px-6 py-5">Status</th>
              <th className="px-6 py-5">On Hand</th>
              <th className="px-6 py-5">Available</th>
              <th className="px-6 py-5">Cost (Avg)</th>
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {items.map((item, idx) => (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="group transition-colors hover:bg-gray-800/40"
              >
                <td className="px-6 py-4">
                  <p className="font-bold text-gray-100">{item.product_name}</p>
                  <p className="text-xs text-blue-400 font-medium tracking-tight">{item.sku || 'No SKU'}</p>
                </td>
                <td className="px-6 py-4 text-gray-400 font-medium italic">
                  {item.location || 'Default'}
                </td>
                <td className="px-6 py-4">
                  {item.quantity_on_hand <= 0 ? (
                    <span className="inline-flex rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-500/20">
                      Out of Stock
                    </span>
                  ) : item.is_low_stock ? (
                    <span className="inline-flex rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-orange-500 border border-orange-500/20">
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-500 border border-emerald-500/20">
                      Healthy
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 font-black text-white">
                  {item.quantity_on_hand}
                </td>
                <td className="px-6 py-4 font-bold text-blue-400">
                  {item.quantity_available}
                </td>
                <td className="px-6 py-4 text-gray-300 font-medium">
                  R{item.average_cost.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => onAdjust(item)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 transition-all hover:bg-blue-500 hover:text-white"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
