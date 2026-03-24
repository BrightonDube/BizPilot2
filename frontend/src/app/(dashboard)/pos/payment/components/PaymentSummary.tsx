/**
 * PaymentSummary.tsx — Summary of payments and balance
 */

'use client';

import { motion } from 'framer-motion';
import { PaymentState } from '../types';

interface PaymentSummaryProps {
  payment: PaymentState;
}

export function PaymentSummary({ payment }: PaymentSummaryProps) {
  const isPaidInFull = payment.balance_remaining === 0;

  return (
    <div className="space-y-4 rounded-3xl bg-gray-900/40 p-6 border border-gray-700/30 backdrop-blur-xl">
      <div className="flex justify-between text-gray-400">
        <span className="text-sm font-semibold uppercase tracking-widest">Total Due</span>
        <span className="text-xl font-bold text-white">R{payment.total_due.toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-gray-400">
        <span className="text-sm font-semibold uppercase tracking-widest">Tendered</span>
        <span className="text-xl font-bold text-emerald-400">R{payment.total_tendered.toFixed(2)}</span>
      </div>

      <div className="my-2 border-t border-gray-700/50 pt-4">
        {payment.balance_remaining > 0 ? (
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Balance Remaining</span>
            <motion.span 
              key={payment.balance_remaining}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-3xl font-black text-blue-400"
            >
              R{payment.balance_remaining.toFixed(2)}
            </motion.span>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">Change Due</span>
            <motion.span 
              key={payment.change_due}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-3xl font-black text-orange-400"
            >
              R{payment.change_due.toFixed(2)}
            </motion.span>
          </div>
        )}
      </div>

      {isPaidInFull && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center"
        >
          <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Ready to finalize order</p>
        </motion.div>
      )}
    </div>
  );
}
