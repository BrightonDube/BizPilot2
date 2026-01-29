'use client';

/**
 * Product detail page.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, Package, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
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
import { apiClient } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  status: string;
  quantity: number;
  low_stock_threshold: number;
  cost_price: number | string | null;
  selling_price: number | string;
  compare_at_price: number | string | null;
  is_taxable: boolean;
  track_inventory: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setIsLoading(true);
        const response = await apiClient.get<Product>(`/products/${productId}`);
        setProduct(response.data);
      } catch (err) {
        console.error('Error fetching product:', err);
      } finally {
        setIsLoading(false);
      }
    }

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const handleDelete = async () => {
    if (!product) return;
    if (!window.confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await apiClient.delete(`/products/${productId}`);
      router.push('/products');
    } catch (err) {
      console.error('Error deleting product:', err);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-100 mb-2">Product not found</h3>
        <p className="text-gray-400 mb-6">The product you are looking for does not exist.</p>
        <Link href="/products">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </Link>
      </div>
    );
  }

  // Derive computed values from product
  const sellingPrice = typeof product.selling_price === 'number' ? product.selling_price : parseFloat(product.selling_price) || 0;
  const costPrice = typeof product.cost_price === 'number' ? product.cost_price : (product.cost_price ? parseFloat(product.cost_price) : 0);
  const compareAtPrice = product.compare_at_price ? (typeof product.compare_at_price === 'number' ? product.compare_at_price : parseFloat(product.compare_at_price)) : null;
  const profitMargin = costPrice > 0 ? (((sellingPrice - costPrice) / costPrice) * 100).toFixed(2) : '0.00';
  const isLowStock = product.track_inventory && product.quantity <= product.low_stock_threshold;

  return (
    <div>
      <PageHeader
        title={product.name}
        description={product.sku ? `SKU: ${product.sku}` : 'No SKU'}
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
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Selling Price"
          value={`R ${Number.isFinite(sellingPrice) ? sellingPrice.toFixed(2) : '0.00'}`}
          description={compareAtPrice ? `Was R ${Number.isFinite(compareAtPrice) ? compareAtPrice.toFixed(2) : '0.00'}` : undefined}
        />
        <StatCard
          title="Cost Price"
          value={`R ${Number.isFinite(costPrice) ? costPrice.toFixed(2) : '0.00'}`}
          description="Per unit cost"
        />
        <StatCard
          title="Profit Margin"
          value={`${profitMargin}%`}
          change={`R ${Number.isFinite(sellingPrice - costPrice) ? (sellingPrice - costPrice).toFixed(2) : '0.00'} per unit`}
          changeType="positive"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="In Stock"
          value={product.quantity.toString()}
          change={isLowStock ? 'Low stock!' : 'Stock OK'}
          changeType={isLowStock ? 'negative' : 'positive'}
          icon={isLowStock ? <AlertTriangle className="w-5 h-5" /> : <Package className="w-5 h-5" />}
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
                  <p className="text-white">{product.category_id ? 'Has Category' : 'Uncategorized'}</p>
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
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Selling Price</span>
                <span className="text-white font-medium">R {Number.isFinite(sellingPrice) ? sellingPrice.toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cost Price</span>
                <span className="text-white">R {Number.isFinite(costPrice) ? costPrice.toFixed(2) : '0.00'}</span>
              </div>
              {compareAtPrice && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Compare at</span>
                  <span className="text-gray-500 line-through">R {Number.isFinite(compareAtPrice) ? compareAtPrice.toFixed(2) : '0.00'}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-400">Profit</span>
                  <span className="text-green-400 font-medium">R {Number.isFinite(sellingPrice - costPrice) ? (sellingPrice - costPrice).toFixed(2) : '0.00'}</span>
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
