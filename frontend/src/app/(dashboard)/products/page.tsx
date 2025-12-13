'use client';

/**
 * Products list page with search, filter, and bulk actions.
 * Fetches real data from the API.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  Package,
  Edit,
  Trash2,
  Eye,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Input,
  Card,
  CardContent,
  Badge,
  EmptyState,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  status: string;
  quantity: number;
  selling_price: number;
  cost_price: number | null;
  image_url: string | null;
  is_low_stock: boolean;
  category_id: string | null;
}

interface ProductListResponse {
  items: Product[];
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

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  draft: 'warning',
  archived: 'default',
  out_of_stock: 'danger',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setIsLoading(true);
        setError(null);
        
        const params = new URLSearchParams({
          page: page.toString(),
          per_page: '20',
        });
        
        if (search) {
          params.append('search', search);
        }
        
        const response = await apiClient.get<ProductListResponse>(`/products?${params}`);
        setProducts(response.data.items);
        setTotal(response.data.total);
        setPages(response.data.pages);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    }

    // Debounce search
    const timeoutId = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeoutId);
  }, [page, search]);

  const filteredProducts = products;

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter((p) => p !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  if (isLoading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold text-white">Unable to load products</h2>
          <p className="text-gray-400 max-w-md">{error}</p>
          <Button variant="gradient" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description={`Manage your product catalog (${total} products)`}
        actions={
          <Link href="/products/new">
            <Button variant="gradient">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </Link>
        }
      />

      {/* Search and Filter Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products by name or SKU..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to first page on search
                }}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedProducts.length > 0 && (
            <div className="mt-4 flex items-center gap-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <span className="text-sm text-blue-400">
                {selectedProducts.length} product(s) selected
              </span>
              <Button variant="outline" size="sm">
                Bulk Edit
              </Button>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Table */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description="Get started by adding your first product to the catalog."
          action={
            <Link href="/products/new">
              <Button variant="gradient">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="p-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded bg-gray-700 border-gray-600"
                    />
                  </th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Product</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">SKU</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Status</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Stock</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Price</th>
                  <th className="p-4 text-right text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => toggleSelectProduct(product.id)}
                        className="rounded bg-gray-700 border-gray-600"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                        <div>
                          <span className="font-medium text-white">{product.name}</span>
                          {product.description && (
                            <p className="text-xs text-gray-400 truncate max-w-xs">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-400">{product.sku || '-'}</td>
                    <td className="p-4">
                      <Badge variant={statusColors[product.status] || 'default'}>
                        {product.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className={product.is_low_stock ? 'text-red-400' : 'text-gray-400'}>
                        {product.quantity}
                        {product.is_low_stock && (
                          <span className="ml-2 text-xs text-red-400">(Low)</span>
                        )}
                      </span>
                    </td>
                    <td className="p-4 text-white">{formatCurrency(product.selling_price)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/products/${product.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/products/${product.id}/edit`}>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              Page {page} of {pages} ({total} products)
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
        </Card>
      )}
    </div>
  );
}
