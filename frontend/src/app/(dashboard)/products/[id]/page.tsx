'use client';

/**
 * Product detail page.
 */

import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  PageHeader,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  StatCard,
} from '@/components/ui';

// Mock product data - in production this would come from API
const mockProduct = {
  id: '1',
  name: 'Premium Widget',
  description: 'A high-quality widget for professional use. Made with durable materials and precision engineering.',
  sku: 'WDG-001',
  barcode: '1234567890123',
  category: 'Widgets',
  status: 'active',
  quantity: 150,
  low_stock_threshold: 10,
  cost_price: 49.99,
  selling_price: 99.99,
  compare_at_price: 129.99,
  is_taxable: true,
  track_inventory: true,
  created_at: '2024-01-15',
  updated_at: '2024-03-20',
};

export default function ProductDetailPage() {
  const product = mockProduct;
  
  const profitMargin = product.cost_price > 0
    ? ((product.selling_price - product.cost_price) / product.selling_price * 100).toFixed(1)
    : '0.0';

  const isLowStock = product.track_inventory && product.quantity <= product.low_stock_threshold;

  return (
    <div>
      <PageHeader
        title={product.name}
        description={`SKU: ${product.sku}`}
        actions={
          <div className="flex items-center gap-3">
            <Link href="/products">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Link href={`/products/${product.id}/edit`}>
              <Button variant="secondary">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Selling Price"
          value={`R ${product.selling_price.toFixed(2)}`}
          description={product.compare_at_price ? `Was R ${product.compare_at_price.toFixed(2)}` : undefined}
        />
        <StatCard
          title="Cost Price"
          value={`R ${product.cost_price.toFixed(2)}`}
          description="Per unit cost"
        />
        <StatCard
          title="Profit Margin"
          value={`${profitMargin}%`}
          change={`R ${(product.selling_price - product.cost_price).toFixed(2)} per unit`}
          changeType="positive"
          icon={TrendingUp}
        />
        <StatCard
          title="In Stock"
          value={product.quantity.toString()}
          change={isLowStock ? 'Low stock!' : 'Stock OK'}
          changeType={isLowStock ? 'negative' : 'positive'}
          icon={isLowStock ? AlertTriangle : Package}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Description</h4>
                <p className="text-white">{product.description || 'No description'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">SKU</h4>
                  <p className="text-white">{product.sku || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Barcode</h4>
                  <p className="text-white">{product.barcode || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Category</h4>
                  <p className="text-white">{product.category || 'Uncategorized'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Status</h4>
                  <Badge variant={product.status === 'active' ? 'success' : 'default'}>
                    {product.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              {product.track_inventory ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-400">Current Stock</p>
                      <p className="text-2xl font-semibold text-white">{product.quantity} units</p>
                    </div>
                    {isLowStock && (
                      <div className="flex items-center gap-2 text-yellow-400">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="text-sm">Low stock warning</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    Low stock alert threshold: {product.low_stock_threshold} units
                  </p>
                </div>
              ) : (
                <p className="text-gray-400">Inventory tracking is disabled for this product</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
                <Package className="h-16 w-16 text-gray-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Selling Price</span>
                <span className="text-white font-medium">R {product.selling_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cost Price</span>
                <span className="text-white">R {product.cost_price.toFixed(2)}</span>
              </div>
              {product.compare_at_price && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Compare at</span>
                  <span className="text-gray-500 line-through">R {product.compare_at_price.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-400">Profit</span>
                  <span className="text-green-400 font-medium">R {(product.selling_price - product.cost_price).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Taxable</span>
                <Badge variant={product.is_taxable ? 'info' : 'default'}>
                  {product.is_taxable ? 'Yes (15% VAT)' : 'No'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Created</span>
                <span className="text-white">{product.created_at}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Updated</span>
                <span className="text-white">{product.updated_at}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
