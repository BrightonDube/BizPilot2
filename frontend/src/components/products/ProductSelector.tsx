'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Package } from 'lucide-react';
import { Input } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

// Reuse Product interface from ProductList, or define a subset needed for selection
export interface Product {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number | string;
  quantity: number;
}

interface ProductListResponse {
  items: Product[];
  total: number;
}

interface ProductSelectorProps {
  onSelect: (product: Product) => void;
  className?: string;
  value?: string;
  onInputChange?: (value: string) => void;
}

export function ProductSelector({ onSelect, className, value, onInputChange }: ProductSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchTerm = value !== undefined ? value : internalSearchTerm;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchTerm && !isOpen) return;

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: '1',
          per_page: '10',
          search: searchTerm,
        });
        const response = await apiClient.get<ProductListResponse>(`/products?${params}`);
        setProducts(response.data.items);
      } catch (error) {
        console.error('Failed to fetch products', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, isOpen]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    setIsOpen(false);
    if (!onInputChange) {
        setInternalSearchTerm(product.name);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (onInputChange) {
          onInputChange(newValue);
      } else {
          setInternalSearchTerm(newValue);
      }
      setIsOpen(true);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className="pl-9"
        />
        {isLoading && (
          <div className="absolute right-3 top-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {products.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">
              {isLoading ? 'Loading...' : 'No products found'}
            </div>
          ) : (
            <div className="py-1">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-800 last:border-0 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-200 truncate">{product.name}</div>
                      <div className="text-xs text-gray-500 flex gap-2">
                        <span>SKU: {product.sku || 'N/A'}</span>
                        <span>•</span>
                        <span className={product.quantity > 0 ? 'text-green-500' : 'text-red-500'}>
                          {product.quantity} in stock
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium text-blue-400 shrink-0 ml-2">
                     {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(product.selling_price))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
