'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter, 
  Mail, 
  Phone, 
  Building2, 
  User,
  Tag,
  DollarSign,
  ShoppingCart,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Button, Input, Card, CardContent, LoadingSpinner } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  customer_type: string;
  total_orders?: number;
  total_spent?: number;
  tags?: string[];
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

interface CustomerListResponse {
  items: Customer[];
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCustomers() {
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
        
        if (selectedType !== 'all') {
          params.append('customer_type', selectedType);
        }
        
        const response = await apiClient.get<CustomerListResponse>(`/customers?${params}`);
        setCustomers(response.data.items);
        setTotal(response.data.total);
        setPages(response.data.pages);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        setError('Failed to load customers');
      } finally {
        setIsLoading(false);
      }
    }

    // Debounce search
    const timeoutId = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timeoutId);
  }, [page, searchTerm, selectedType]);

  const filteredCustomers = customers;

  const totalCustomers = total;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  const businessCustomers = customers.filter(c => c.customer_type === 'business').length;
  const totalOrders = customers.reduce((sum, c) => sum + (c.total_orders || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  if (isLoading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading customers...</p>
        </div>
      </div>
    );
  }

  if (error && customers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold text-white">Unable to load customers</h2>
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
        title="Customers"
        description={`Manage your customer relationships (${totalCustomers} customers)`}
        actions={
          <Link href="/customers/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Customers"
          value={totalCustomers}
          icon={<User className="w-5 h-5" />}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Business Customers"
          value={businessCustomers}
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(avgOrderValue)}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <label htmlFor="customer-type-filter" className="sr-only">Filter by customer type</label>
        <select
          id="customer-type-filter"
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Types</option>
          <option value="individual">Individual</option>
          <option value="business">Business</option>
        </select>
        <Button variant="outline" className="border-gray-700">
          <Filter className="w-4 h-4 mr-2" />
          More Filters
        </Button>
      </div>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          title="No customers found"
          description={customers.length === 0 
            ? "Add your first customer to get started"
            : "Try adjusting your search or filters"
          }
          action={
            <Link href="/customers/new">
              <Button>Add Your First Customer</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredCustomers.map((customer) => (
            <Link key={customer.id} href={`/customers/${customer.id}`}>
              <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        customer.customer_type === 'business' 
                          ? 'bg-purple-500/20 text-purple-400' 
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {customer.customer_type === 'business' ? (
                          <Building2 className="w-6 h-6" />
                        ) : (
                          <User className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">
                            {customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`}
                          </h3>
                          {customer.tags?.includes('vip') && (
                            <Badge variant="warning">VIP</Badge>
                          )}
                        </div>
                        {customer.company_name && (
                          <p className="text-sm text-gray-400">
                            {customer.first_name} {customer.last_name}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {customer.email || 'No email'}
                          </span>
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {customer.phone}
                            </span>
                          )}
                        </div>
                        {customer.tags && customer.tags.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <Tag className="w-3 h-3 text-gray-500" />
                            {customer.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">
                        {formatCurrency(customer.total_spent || 0)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {customer.total_orders || 0} orders
                      </div>
                      {customer.city && (
                        <div className="text-xs text-gray-500 mt-1">
                          {customer.city}{customer.country ? `, ${customer.country}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-400">
            Page {page} of {pages} ({total} customers)
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
