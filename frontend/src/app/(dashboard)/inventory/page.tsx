'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Package,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  ArrowUpDown,
  History,
  Loader2
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface InventoryItem {
  id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_point: number;
  location: string | null;
  bin_location: string | null;
  average_cost: number;
  is_low_stock: boolean;
  created_at: string;
}

interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInventory() {
      try {
        setIsLoading(true);
        setError(null);
        
        const params = new URLSearchParams({
          page: page.toString(),
          per_page: '20',
        });
        
        if (searchTerm) {
          params.append('search', searchTerm);
        }
        
        if (showLowStockOnly) {
          params.append('low_stock', 'true');
        }
        
        const response = await apiClient.get<InventoryListResponse>(`/inventory?${params}`);
        setInventoryItems(response.data.items);
        setTotal(response.data.total);
        setPages(response.data.pages);
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
        setError('Failed to load inventory');
      } finally {
        setIsLoading(false);
      }
    }

    // Debounce search
    const timeoutId = setTimeout(fetchInventory, 300);
    return () => clearTimeout(timeoutId);
  }, [page, searchTerm, showLowStockOnly]);

  const filteredInventory = inventoryItems;

  const totalItems = total;
  const totalValue = inventoryItems.reduce((sum, i) => sum + (i.quantity_on_hand * i.average_cost), 0);
  const lowStockCount = inventoryItems.filter(i => i.is_low_stock).length;
  const outOfStockCount = inventoryItems.filter(i => i.quantity_on_hand === 0).length;

  if (isLoading && inventoryItems.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (error && inventoryItems.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold text-white">Unable to load inventory</h2>
          <p className="text-gray-400 max-w-md">{error}</p>
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`Track and manage stock levels (${totalItems} items)`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="border-gray-700">
              <History className="w-4 h-4 mr-2" />
              Transactions
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Adjust Stock
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Items"
          value={totalItems}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Total Value"
          value={formatCurrency(totalValue)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Low Stock"
          value={lowStockCount}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <StatCard
          title="Out of Stock"
          value={outOfStockCount}
          icon={<TrendingDown className="w-5 h-5" />}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <Button 
          variant={showLowStockOnly ? "default" : "outline"}
          className={showLowStockOnly ? "bg-red-600 hover:bg-red-700" : "border-gray-700"}
          onClick={() => {
            setShowLowStockOnly(!showLowStockOnly);
            setPage(1);
          }}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Low Stock Only
        </Button>
        <Button variant="outline" className="border-gray-700">
          <Filter className="w-4 h-4 mr-2" />
          More Filters
        </Button>
      </div>

      {filteredInventory.length === 0 ? (
        <EmptyState
          title="No inventory items found"
          description="Try adjusting your search or filters"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Product</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">SKU</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">On Hand</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Available</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Reorder Point</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Location</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Value</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => {
                const available = item.quantity_available ?? (item.quantity_on_hand - item.quantity_reserved);
                const value = item.quantity_on_hand * item.average_cost;
                const isOutOfStock = item.quantity_on_hand === 0;
                
                return (
                  <tr 
                    key={item.id} 
                    className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{item.product_name || 'Unknown Product'}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{item.sku || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${
                        isOutOfStock ? 'text-red-400' : 
                        item.is_low_stock ? 'text-yellow-400' : 'text-white'
                      }`}>
                        {item.quantity_on_hand}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-400">{available}</td>
                    <td className="py-3 px-4 text-right text-gray-400">{item.reorder_point}</td>
                    <td className="py-3 px-4">
                      <div className="text-white">{item.location || 'Not assigned'}</div>
                      {item.bin_location && (
                        <div className="text-xs text-gray-500">{item.bin_location}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      {formatCurrency(value)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isOutOfStock ? (
                        <Badge variant="danger">Out of Stock</Badge>
                      ) : item.is_low_stock ? (
                        <Badge variant="warning">Low Stock</Badge>
                      ) : (
                        <Badge variant="success">In Stock</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-400">
            Page {page} of {pages} ({total} items)
          </span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
