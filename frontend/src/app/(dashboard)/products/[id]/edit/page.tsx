'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, FolderTree } from 'lucide-react';
import {
  PageHeader,
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  ImageInput,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  cost_price: number | null;
  selling_price: number;
  compare_at_price: number | null;
  quantity: number;
  low_stock_threshold: number;
  is_taxable: boolean;
  track_inventory: boolean;
  status: string;
  image_url: string | null;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    cost_price: '',
    selling_price: '',
    compare_at_price: '',
    quantity: '0',
    low_stock_threshold: '10',
    is_taxable: true,
    track_inventory: true,
    status: 'active',
    image_url: '',
    category_id: '',
  });

  useEffect(() => {
    async function fetchProduct() {
      try {
        setIsFetching(true);
        setError(null);
        const response = await apiClient.get<Product>(`/products/${productId}`);
        const product = response.data;
        
        setFormData({
          name: product.name || '',
          description: product.description || '',
          sku: product.sku || '',
          barcode: product.barcode || '',
          cost_price: product.cost_price?.toString() || '',
          selling_price: product.selling_price?.toString() || '',
          compare_at_price: product.compare_at_price?.toString() || '',
          quantity: product.quantity?.toString() || '0',
          low_stock_threshold: product.low_stock_threshold?.toString() || '10',
          is_taxable: product.is_taxable ?? true,
          track_inventory: product.track_inventory ?? true,
          status: product.status || 'active',
          image_url: product.image_url || '',
          category_id: product.category_id || '',
        });
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Failed to load product. Please try again.');
      } finally {
        setIsFetching(false);
      }
    }

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await apiClient.get<{ items: Category[] }>('/categories');
        setCategories(response.data.items);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    }
    fetchCategories();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const productData = {
        name: formData.name,
        description: formData.description || null,
        sku: formData.sku || null,
        barcode: formData.barcode || null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        selling_price: parseFloat(formData.selling_price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        quantity: parseInt(formData.quantity) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        is_taxable: formData.is_taxable,
        track_inventory: formData.track_inventory,
        status: formData.status,
        image_url: formData.image_url || null,
        category_id: formData.category_id || null,
      };

      await apiClient.put(`/products/${productId}`, productData);
      router.push(`/products/${productId}`);
    } catch (err) {
      console.error('Error updating product:', err);
      setError('Failed to update product. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const costPrice = parseFloat(formData.cost_price) || 0;
  const sellingPrice = parseFloat(formData.selling_price) || 0;
  const profitMargin = sellingPrice > 0 && costPrice > 0
    ? ((sellingPrice - costPrice) / sellingPrice * 100).toFixed(1)
    : '0.0';

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Edit Product"
        description="Update product details and pricing"
        actions={
          <Link href={`/products/${productId}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Product
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Product Name *
                  </label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter product name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter product description"
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      SKU
                    </label>
                    <Input
                      name="sku"
                      value={formData.sku}
                      onChange={handleChange}
                      placeholder="e.g., PRD-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Barcode
                    </label>
                    <Input
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleChange}
                      placeholder="e.g., 1234567890"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Cost Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                      <Input
                        name="cost_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.cost_price}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Selling Price *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                      <Input
                        name="selling_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.selling_price}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="pl-8"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Compare at Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                      <Input
                        name="compare_at_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.compare_at_price}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>

                {/* Profit Margin Calculator */}
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Profit Margin</span>
                    <span className={`text-lg font-semibold ${parseFloat(profitMargin) > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                      {profitMargin}%
                    </span>
                  </div>
                  {costPrice > 0 && sellingPrice > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Profit per unit: R {(sellingPrice - costPrice).toFixed(2)}
                    </p>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    name="is_taxable"
                    checked={formData.is_taxable}
                    onChange={handleChange}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  This product is taxable (VAT)
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    name="track_inventory"
                    checked={formData.track_inventory}
                    onChange={handleChange}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  Track inventory for this product
                </label>

                {formData.track_inventory && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Quantity in Stock
                      </label>
                      <Input
                        name="quantity"
                        type="number"
                        min="0"
                        value={formData.quantity}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Low Stock Alert
                      </label>
                      <Input
                        name="low_stock_threshold"
                        type="number"
                        min="0"
                        value={formData.low_stock_threshold}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4" />
                  Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <Link href="/categories" className="block mt-2 text-xs text-blue-400 hover:text-blue-300">
                  Manage Categories →
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Product Image</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageInput
                  value={formData.image_url}
                  onChange={(url) => setFormData({ ...formData, image_url: url })}
                  maxSize={5}
                  placeholder="Add product image"
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button type="submit" variant="gradient" disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving...' : 'Update Product'}
              </Button>
              <Link href={`/products/${productId}`}>
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
