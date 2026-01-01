'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, User, Building2 } from 'lucide-react';
import { Input } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string;
  customer_type: string;
}

interface CustomerListResponse {
  items: Customer[];
  total: number;
}

interface CustomerSelectorProps {
  onSelect: (customer: Customer) => void;
  className?: string;
  selectedCustomerId?: string | null;
}

export function CustomerSelector({ onSelect, className, selectedCustomerId }: CustomerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCustomerId) {
        // Ideally we would fetch the specific customer details here if we only have ID
        // For now, we rely on the parent or user search interaction
        // Or we could implement a fetch-one effect if needed
    }
  }, [selectedCustomerId]);

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
    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
          const params = new URLSearchParams({
            page: '1',
            per_page: '10',
            search: searchTerm,
          });
          const response = await apiClient.get<CustomerListResponse>(`/customers?${params}`);
          setCustomers(response.data.items);
        } catch (error) {
          console.error('Failed to fetch customers', error);
        } finally {
          setIsLoading(false);
        }
    };

    if (isOpen) {
        // Debounce only when typing search
        const delayDebounceFn = setTimeout(fetchCustomers, 300);
        return () => clearTimeout(delayDebounceFn);
    }
  }, [searchTerm, isOpen]);

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    setIsOpen(false);
    const name = customer.company_name || `${customer.first_name} ${customer.last_name}`;
    setSearchTerm(name); 
    setSelectedCustomerLabel(name);
  };

  const displayName = (c: Customer) => c.company_name || `${c.first_name} ${c.last_name}`;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            // Optional: clear search if it was a selection to allow new search? 
            // Or keep it to refine? Let's keep for now.
             if (searchTerm === selectedCustomerLabel && searchTerm !== '') {
                 setSearchTerm('');
             }
          }}
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
          {customers.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">
              {isLoading ? 'Loading...' : 'No customers found'}
            </div>
          ) : (
            <div className="py-1">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelect(customer)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-800 last:border-0 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                        customer.customer_type === 'business' 
                        ? 'bg-purple-900/30 text-purple-400' 
                        : 'bg-blue-900/30 text-blue-400'
                    }`}>
                        {customer.customer_type === 'business' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-200 truncate">{displayName(customer)}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {customer.email}
                      </div>
                    </div>
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
