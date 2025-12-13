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
  History
} from 'lucide-react';
import { Button, Input, LoadingSpinner } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface InventoryItem {
  id: string;
  product_name: string;
  sku: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_point: number;
  location: string;
  bin_location: string;
  average_cost: number;
  is_low_stock: boolean;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await apiClient.get('/inventory', {
        params: { limit: 50 },
      });
      setInventory(response.data.items || []);
    } catch (error) {
      // Use empty array if API is not available
      setInventory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLowStock = !showLowStockOnly || item.is_low_stock;
    return matchesSearch && matchesLowStock;
  });

  const totalItems = inventory.length;
  const totalValue = inventory.reduce((sum, i) => sum + ((i.quantity_on_hand || 0) * (i.average_cost || 0)), 0);
  const lowStockCount = inventory.filter(i => i.is_low_stock).length;
  const outOfStockCount = inventory.filter(i => (i.quantity_on_hand || 0) === 0).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Track and manage stock levels"
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
          value={`R ${totalValue.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Low Stock"
          value={lowStockCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          trend={lowStockCount > 0 ? { value: lowStockCount, isPositive: false } : undefined}
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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <Button 
          variant={showLowStockOnly ? "default" : "outline"}
          className={showLowStockOnly ? "bg-red-600 hover:bg-red-700" : "border-gray-700"}
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
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
          description={inventory.length === 0 
            ? "Add products to start tracking inventory"
            : "Try adjusting your search or filters"
          }
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
                const available = (item.quantity_on_hand || 0) - (item.quantity_reserved || 0);
                const value = (item.quantity_on_hand || 0) * (item.average_cost || 0);
                const isOutOfStock = (item.quantity_on_hand || 0) === 0;
                
                return (
                  <tr 
                    key={item.id} 
                    className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{item.product_name}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{item.sku || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${
                        isOutOfStock ? 'text-red-400' : 
                        item.is_low_stock ? 'text-yellow-400' : 'text-white'
                      }`}>
                        {item.quantity_on_hand || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-400">{available}</td>
                    <td className="py-3 px-4 text-right text-gray-400">{item.reorder_point || 0}</td>
                    <td className="py-3 px-4">
                      <div className="text-white">{item.location || '-'}</div>
                      {item.bin_location && (
                        <div className="text-xs text-gray-500">{item.bin_location}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      R {value.toLocaleString()}
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
    </div>
  );
}
