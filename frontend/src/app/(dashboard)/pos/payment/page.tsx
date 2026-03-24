/**
 * page.tsx — POS Payment Screen
 * Dynamic payment handling with split payment support.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { usePayment } from '@/hooks/usePayment';
import { PaymentMethodSelector } from './components/PaymentMethodSelector';
import { TenderLineRow } from './components/TenderLineRow';
import { PaymentSummary } from './components/PaymentSummary';
import { CashPaymentPanel } from './components/CashPaymentPanel';
import { CardPaymentPanel } from './components/CardPaymentPanel';
import { EFTPaymentPanel } from './components/EFTPaymentPanel';
import { PaymentMethodType } from './types';

export default function PaymentPage() {
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const { payment, addTender, removeTender, submitOrder } = usePayment(cart);

  const [activeMethod, setActiveMethod] = useState<PaymentMethodType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFinalize = async () => {
    setError(null);
    const result = await submitOrder();
    if (result.success) {
      clearCart();
      router.push(`/pos/receipt?orderId=${result.order_id}`);
    } else {
      setError(result.error || 'Failed to finalize order');
    }
  };

  const isCompleted = payment.balance_remaining === 0;
  const isProcessing = payment.status === 'processing';

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-[#0a0a0c] text-white p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.back()}
              className="group flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-700/50 bg-gray-800/40 text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
            >
              <ArrowLeft className="h-6 w-6 transition-transform group-hover:-translate-x-1" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter sm:text-4xl">
                Payment <span className="text-blue-500">Processing</span>
              </h1>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Order Details • {cart.items.length} Items</p>
            </div>
          </div>

          <div className="hidden lg:block">
            <PaymentSummary payment={payment} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
          <main className="space-y-8">
            <AnimatePresence mode="wait">
              {!activeMethod ? (
                <motion.div
                  key="selector"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Select Payment Method</h2>
                  <PaymentMethodSelector onSelect={setActiveMethod} />
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {activeMethod === 'cash' && (
                    <CashPaymentPanel
                      balanceRemaining={payment.balance_remaining}
                      onAddTender={(amt) => {
                        addTender('cash-method', 'Cash', 'cash', amt);
                        setActiveMethod(null);
                      }}
                      onCancel={() => setActiveMethod(null)}
                    />
                  )}
                  {activeMethod === 'card' && (
                    <CardPaymentPanel
                      balanceRemaining={payment.balance_remaining}
                      onAddTender={(amt) => {
                        addTender('card-method', 'Card Payment', 'card', amt);
                        setActiveMethod(null);
                      }}
                      onCancel={() => setActiveMethod(null)}
                    />
                  )}
                  {activeMethod === 'eft' && (
                    <EFTPaymentPanel
                      balanceRemaining={payment.balance_remaining}
                      onAddTender={(amt) => {
                        addTender('eft-method', 'EFT Transfer', 'eft', amt);
                        setActiveMethod(null);
                      }}
                      onCancel={() => setActiveMethod(null)}
                    />
                  )}
                </div>
              )}
            </AnimatePresence>

            {payment.tender_lines.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Tender Lines</h2>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {payment.tender_lines.map((line) => (
                      <TenderLineRow
                        key={line.id}
                        line={line}
                        onRemove={removeTender}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </main>

          <aside className="space-y-6">
            <div className="lg:hidden">
              <PaymentSummary payment={payment} />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-400"
              >
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}

            <button
              disabled={!isCompleted || isProcessing}
              onClick={handleFinalize}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl py-6 text-xl font-black uppercase tracking-widest transition-all ${
                isCompleted && !isProcessing
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30 hover:bg-blue-500'
                  : 'cursor-not-allowed bg-gray-800 text-gray-600 border border-gray-700/50'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Finalizing...
                </>
              ) : isCompleted ? (
                <>
                  <CheckCircle2 className="h-6 w-6" />
                  Finalize Sale
                </>
              ) : (
                'Awaiting Tender'
              )}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
