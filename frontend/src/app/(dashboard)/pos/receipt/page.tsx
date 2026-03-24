/**
 * page.tsx — Receipt / Order Confirmation Screen
 * Displays order summary and provides printing/download options.
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Printer, FileText, ArrowRight, Loader2, Home } from 'lucide-react';
import { apiClient } from '@/lib/api';

/** Single line item on a completed order receipt */
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  total: number;
}

/** Order response from GET /orders/{id} used by the receipt screen */
interface OrderResponse {
  order_number: string;
  items_count: number;
  items: OrderItem[];
  total: number;
}

function ReceiptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const response = await apiClient.get(`/orders/${orderId}`);
        setOrder(response.data);
      } catch (err) {
        console.error('Failed to fetch order:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handlePrint = async () => {
    if (!orderId) return;
    try {
      setIsPrinting(true);
      const response = await apiClient.get(`/orders/${orderId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Receipt-${order?.order_number || 'Order'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0c]">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0c] text-white">
        <p className="text-xl font-black uppercase tracking-widest text-gray-500">Order Not Found</p>
        <button
          onClick={() => router.push('/pos')}
          className="mt-6 flex items-center gap-2 text-blue-500 font-bold hover:underline"
        >
          <Home className="h-5 w-5" />
          Back to POS
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6 lg:p-10 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[40px] border border-gray-700/50 bg-gray-900/60 p-10 backdrop-blur-3xl shadow-2xl text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10, stiffness: 100, delay: 0.2 }}
            className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[32px] bg-emerald-500/10 text-emerald-500"
          >
            <CheckCircle2 className="h-12 w-12" />
          </motion.div>

          <h1 className="text-4xl font-black uppercase tracking-tighter">Sale <span className="text-blue-500">Successful</span></h1>
          <p className="mt-2 text-sm font-bold text-gray-500 uppercase tracking-widest">Order #{order.order_number}</p>

          <div className="my-10 space-y-4 rounded-3xl bg-gray-800/40 p-8 text-left">
            <div className="flex justify-between items-center text-sm font-bold text-gray-400 uppercase tracking-widest">
              <span>Items Summary</span>
              <span>{order.items_count} Items</span>
            </div>
            <div className="h-px bg-gray-700/50" />
            <div className="space-y-3">
              {order.items.slice(0, 3).map((item: OrderItem) => (
                <div key={item.id} className="flex justify-between text-lg">
                  <span className="font-bold text-gray-200">{item.name} <span className="text-gray-500">×{item.quantity}</span></span>
                  <span className="font-black">R{item.total.toFixed(2)}</span>
                </div>
              ))}
              {order.items_count > 3 && (
                <p className="text-xs font-bold text-blue-500">+{order.items_count - 3} more items...</p>
              )}
            </div>
            <div className="h-px bg-gray-700/50" />
            <div className="flex justify-between items-center pt-2">
              <span className="text-xl font-bold text-gray-400">Total Paid</span>
              <span className="text-4xl font-black text-blue-500">R{order.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center justify-center gap-3 rounded-2xl border border-gray-700/50 bg-gray-800 py-4 font-black uppercase tracking-widest text-white transition-all hover:bg-gray-700 active:scale-95 disabled:opacity-50"
            >
              {isPrinting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
              Print Receipt
            </button>
            <button
              onClick={() => router.push('/pos')}
              className="flex items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/30 transition-all hover:bg-blue-500 active:scale-95"
            >
              New Sale
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
          
          <button
            onClick={() => router.push(`/orders/${orderId}`)}
            className="mt-8 flex items-center justify-center gap-2 mx-auto text-xs font-bold text-gray-600 uppercase tracking-[0.2em] hover:text-gray-400 transition-colors"
          >
            <FileText className="h-4 w-4" />
            View Full Order Details
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0a0a0c]">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    }>
      <ReceiptContent />
    </Suspense>
  );
}
