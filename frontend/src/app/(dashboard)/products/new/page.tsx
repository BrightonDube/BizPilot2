'use client';

/**
 * New product creation page.
 */

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, RefreshCw, Calculator, TrendingUp, Percent, FolderTree } from 'lucide-react';
import {
  PageHeader,
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  color: string | null;
}

export default function NewProductPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
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
    category_id: '',
  });

  // Fetch categories on mount
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
      // Build the product data for API
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
        category_id: formData.category_id || null,
      };

      await apiClient.post('/products', productData);
      router.push('/products');
    } catch (err) {
      console.error('Error creating product:', err);
      setError('Failed to create product. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate SKU when product name changes
  const generateSku = () => {
    if (!formData.name) return;
    const prefix = formData.name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 3);
    const timestamp = Date.now().toString().slice(-4);
    const newSku = `${prefix}-${timestamp}`;
    setFormData(prev => ({ ...prev, sku: newSku }));
  };

  // Calculate pricing metrics
  const costPrice = parseFloat(formData.cost_price) || 0;
  const sellingPrice = parseFloat(formData.selling_price) || 0;
  const compareAtPrice = parseFloat(formData.compare_at_price) || 0;
  
  // Profit calculations
  const profit = sellingPrice - costPrice;
  const profitMargin = sellingPrice > 0 && costPrice > 0
    ? ((profit / sellingPrice) * 100).toFixed(1)
    : '0.0';
  const markup = costPrice > 0
    ? ((profit / costPrice) * 100).toFixed(1)
    : '0.0';
  
  // Discount calculation (if compare_at_price is set)
  const discount = compareAtPrice > 0 && sellingPrice > 0
    ? (((compareAtPrice - sellingPrice) / compareAtPrice) * 100).toFixed(0)
    : '0';

  // Calculate suggested selling price based on desired margin
  const calculatePriceFromMargin = (desiredMargin: number) => {
    if (costPrice > 0) {
      const suggestedPrice = costPrice / (1 - desiredMargin / 100);
      setFormData(prev => ({ ...prev, selling_price: suggestedPrice.toFixed(2) }));
    }
  };

  // Calculate suggested selling price based on desired markup
  const calculatePriceFromMarkup = (desiredMarkup: number) => {
    if (costPrice > 0) {
      const suggestedPrice = costPrice * (1 + desiredMarkup / 100);
      setFormData(prev => ({ ...prev, selling_price: suggestedPrice.toFixed(2) }));
    }
  };

  return (
    <div>
      <PageHeader
        title="Add New Product"
        description="Create a new product in your catalog"
        actions={
          <Link href="/products">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
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
                    <div className="flex gap-2">
                      <Input
                        name="sku"
                        value={formData.sku}
                        onChange={handleChange}
                        placeholder="e.g., PRD-001"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateSku}
                        disabled={!formData.name}
                        title="Auto-generate SKU from product name"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
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

                {/* Profit Calculator */}
                <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-200">Pricing Calculator</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-2 bg-gray-800/50 rounded">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3 text-green-400" />
                        <span className="text-xs text-gray-400">Profit</span>
                      </div>
                      <span className={`text-lg font-semibold ${profit > 0 ? 'text-green-400' : profit < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        R {profit.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-center p-2 bg-gray-800/50 rounded">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Percent className="h-3 w-3 text-blue-400" />
                        <span className="text-xs text-gray-400">Margin</span>
                      </div>
                      <span className={`text-lg font-semibold ${parseFloat(profitMargin) > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                        {profitMargin}%
                      </span>
                    </div>
                    <div className="text-center p-2 bg-gray-800/50 rounded">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Percent className="h-3 w-3 text-purple-400" />
                        <span className="text-xs text-gray-400">Markup</span>
                      </div>
                      <span className={`text-lg font-semibold ${parseFloat(markup) > 0 ? 'text-purple-400' : 'text-gray-400'}`}>
                        {markup}%
                      </span>
                    </div>
                  </div>

                  {compareAtPrice > 0 && sellingPrice > 0 && compareAtPrice > sellingPrice && (
                    <div className="mt-2 p-2 bg-orange-900/20 border border-orange-500/30 rounded text-center">
                      <span className="text-xs text-orange-400">Discount: {discount}% off</span>
                    </div>
                  )}

                  {/* Quick margin presets */}
                  {costPrice > 0 && (
                    <div className="pt-3 border-t border-gray-600">
                      <p className="text-xs text-gray-400 mb-2">Quick set selling price by margin:</p>
                      <div className="flex gap-2 flex-wrap">
                        {[20, 30, 40, 50].map((margin) => (
                          <button
                            key={margin}
                            type="button"
                            onClick={() => calculatePriceFromMargin(margin)}
                            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                          >
                            {margin}% margin
                          </button>
                        ))}
                      </div>
                    </div>
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

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button type="submit" variant="gradient" disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Product'}
              </Button>
              <Link href="/products">
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
