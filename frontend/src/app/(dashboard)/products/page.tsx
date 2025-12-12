'use client';

/**
 * Products list page with search, filter, and bulk actions.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  Package,
  Edit,
  Trash2,
  Eye,
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

// Mock data - in production this would come from API
const mockProducts = [
  {
    id: '1',
    name: 'Premium Widget',
    sku: 'WDG-001',
    category: 'Widgets',
    status: 'active',
    quantity: 150,
    selling_price: 99.99,
    image_url: null,
  },
  {
    id: '2',
    name: 'Standard Gadget',
    sku: 'GDG-002',
    category: 'Gadgets',
    status: 'active',
    quantity: 8,
    selling_price: 49.99,
    image_url: null,
  },
  {
    id: '3',
    name: 'Deluxe Package',
    sku: 'PKG-003',
    category: 'Packages',
    status: 'draft',
    quantity: 25,
    selling_price: 199.99,
    image_url: null,
  },
  {
    id: '4',
    name: 'Basic Bundle',
    sku: 'BND-004',
    category: 'Bundles',
    status: 'active',
    quantity: 0,
    selling_price: 29.99,
    image_url: null,
  },
  {
    id: '5',
    name: 'Pro Subscription',
    sku: 'SUB-005',
    category: 'Subscriptions',
    status: 'archived',
    quantity: 999,
    selling_price: 9.99,
    image_url: null,
  },
];

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  draft: 'warning',
  archived: 'default',
  out_of_stock: 'danger',
};

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const filteredProducts = mockProducts.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.sku.toLowerCase().includes(search.toLowerCase())
  );

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

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your product catalog"
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
                onChange={(e) => setSearch(e.target.value)}
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
                      checked={selectedProducts.length === filteredProducts.length}
                      onChange={toggleSelectAll}
                      className="rounded bg-gray-700 border-gray-600"
                    />
                  </th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Product</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">SKU</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Category</th>
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
                        <span className="font-medium text-white">{product.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-400">{product.sku}</td>
                    <td className="p-4 text-gray-400">{product.category}</td>
                    <td className="p-4">
                      <Badge variant={statusColors[product.status] || 'default'}>
                        {product.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className={product.quantity <= 10 ? 'text-red-400' : 'text-gray-400'}>
                        {product.quantity}
                      </span>
                    </td>
                    <td className="p-4 text-white">R {product.selling_price.toFixed(2)}</td>
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
              Showing {filteredProducts.length} of {mockProducts.length} products
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
