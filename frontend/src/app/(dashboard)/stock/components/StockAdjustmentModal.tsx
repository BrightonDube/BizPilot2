/**
 * StockAdjustmentModal.tsx — Modal for making inventory adjustments
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle, Info } from 'lucide-react';
import { StockItem, StockAdjustment } from '../types';

interface StockAdjustmentModalProps {
  item: StockItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (adjustment: StockAdjustment) => Promise<void>;
}

export function StockAdjustmentModal({
  item,
  isOpen,
  onClose,
  onSave,
}: StockAdjustmentModalProps) {
  const [adjustment, setAdjustment] = useState<StockAdjustment>({
    adjustment_type: 'relative',
    quantity: 0,
    reason: 'manual_adjustment',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await onSave(adjustment);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save adjustment');
    } finally {
      setIsSaving(false);
    }
  };

  const newQuantity = adjustment.adjustment_type === 'absolute' 
    ? adjustment.quantity 
    : item.quantity_on_hand + adjustment.quantity;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-[60] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[32px] border border-gray-700/50 bg-gray-900/80 p-8 backdrop-blur-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Adjust Stock</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-gray-200">{item.product_name}</p>
                  <p className="text-xs text-blue-400/60 font-medium">SKU: {item.sku}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setAdjustment({ ...adjustment, adjustment_type: 'relative' })}
                  className={`rounded-2xl border py-4 text-sm font-black uppercase tracking-widest transition-all ${
                    adjustment.adjustment_type === 'relative'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-lg shadow-blue-500/10'
                      : 'border-gray-700/50 bg-gray-800/40 text-gray-500'
                  }`}
                >
                  Relative (+/-)
                </button>
                <button
                  onClick={() => setAdjustment({ ...adjustment, adjustment_type: 'absolute' })}
                  className={`rounded-2xl border py-4 text-sm font-black uppercase tracking-widest transition-all ${
                    adjustment.adjustment_type === 'absolute'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-lg shadow-blue-500/10'
                      : 'border-gray-700/50 bg-gray-800/40 text-gray-500'
                  }`}
                >
                  Absolute (Set)
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {adjustment.adjustment_type === 'relative' ? 'Add / Subtract Qty' : 'New Total Quantity'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={adjustment.quantity}
                    onChange={(e) => setAdjustment({ ...adjustment, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-2xl border border-gray-700/50 bg-gray-800/40 py-4 px-6 text-2xl font-black text-white outline-none focus:ring-4 focus:ring-blue-500/30 transition-all"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-right">
                    <p className="text-[10px] uppercase font-black text-gray-500">Result</p>
                    <p className="text-lg font-black text-blue-400">{newQuantity}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Reason</label>
                <select
                  value={adjustment.reason}
                  onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })}
                  className="w-full rounded-2xl border border-gray-700/50 bg-gray-800/40 py-4 px-6 font-bold text-white outline-none focus:ring-4 focus:ring-blue-500/30 transition-all appearance-none"
                >
                  <option value="manual_adjustment">Manual Adjustment</option>
                  <option value="received_stock">Received Stock</option>
                  <option value="waste">Damaged / Waste</option>
                  <option value="return">Customer Return</option>
                  <option value="correction">Data Correction</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Notes</label>
                <textarea
                  value={adjustment.notes}
                  onChange={(e) => setAdjustment({ ...adjustment, notes: e.target.value })}
                  placeholder="Optional details..."
                  className="w-full rounded-2xl border border-gray-700/50 bg-gray-800/40 py-4 px-6 font-medium text-white outline-none focus:ring-4 focus:ring-blue-500/30 transition-all h-24 resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="mt-6 flex gap-3 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-500">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-bold">{error}</p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-lg font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/30 transition-all hover:from-blue-500 hover:to-blue-400 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <span className="animate-pulse">Saving Adjustment...</span> : (
                <>
                  <Save className="h-5 w-5" />
                  Save Adjustment
                </>
              )}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
