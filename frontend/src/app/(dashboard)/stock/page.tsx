/**
 * page.tsx — Stock Control Dashboard
 * Overview of inventory levels with adjustment capabilities.
 */

'use client';

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Plus, AlertTriangle } from 'lucide-react';
import { useStock } from '@/hooks/useStock';
import { InventorySummaryCard } from './components/InventorySummaryCard';
import { StockItemTable } from './components/StockItemTable';
import { StockAdjustmentModal } from './components/StockAdjustmentModal';
import { StockItem } from './types';

export default function StockControlPage() {
  const { items, summary, isLoading, error, fetchInventory, fetchSummary, adjustStock } = useStock();
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [search, setSearch] = useState('');
  type FilterType = 'all' | 'low' | 'out';
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    fetchInventory({ search, low_stock_only: filter === 'low' });
    fetchSummary();
  }, [fetchInventory, fetchSummary, search, filter]);

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-[#0a0a0c] text-white p-6 lg:p-10 space-y-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter sm:text-5xl">
            Stock <span className="text-blue-500">Control</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500 uppercase tracking-[0.3em]">Inventory & Warehouse Management</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchInventory(); fetchSummary(); }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-700/50 bg-gray-800/40 text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/30 transition-all hover:bg-blue-500 active:scale-95">
            <Plus className="h-5 w-5" />
            Stock Take
          </button>
        </div>
      </header>

      {summary && <InventorySummaryCard summary={summary} />}

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600" />
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-700/50 bg-gray-900/40 py-4 pl-14 pr-6 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-gray-900/60 border border-gray-700/50 backdrop-blur-md">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'low', label: 'Low Stock' },
              { id: 'out', label: 'Out of Stock' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id as FilterType)}
                className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  filter === btn.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-[32px] border border-red-500/20 bg-red-500/5 p-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Inventory Sync Error</h3>
            <p className="mt-2 text-sm text-red-400/60 max-w-sm">{error}</p>
          </div>
        ) : (
          <StockItemTable 
            items={items} 
            onAdjust={(item) => setSelectedItem(item)} 
          />
        )}
      </div>

      {selectedItem && (
        <StockAdjustmentModal
          item={selectedItem}
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          onSave={(adj) => adjustStock(selectedItem.id, adj).then(() => {})}
        />
      )}
    </div>
  );
}
