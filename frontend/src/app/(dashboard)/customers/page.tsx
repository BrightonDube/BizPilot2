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
  ShoppingCart
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
  total_orders: number;
  total_spent: number;
  tags: string[];
  city: string | null;
  country: string | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await apiClient.get('/customers', {
        params: { limit: 50 },
      });
      setCustomers(response.data.items || []);
    } catch (error) {
      // Use empty array if API is not available
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesType = selectedType === 'all' || customer.customer_type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  const businessCustomers = customers.filter(c => c.customer_type === 'business').length;
  const totalOrders = customers.reduce((sum, c) => sum + (c.total_orders || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

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
        title="Customers"
        description="Manage your customer relationships"
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
          value={`R ${totalRevenue.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Business Customers"
          value={businessCustomers}
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Order Value"
          value={`R ${avgOrderValue.toFixed(2)}`}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <label htmlFor="customer-type-filter" className="sr-only">Filter by customer type</label>
        <select
          id="customer-type-filter"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
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
                        R {(customer.total_spent || 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400">
                        {customer.total_orders || 0} orders
                      </div>
                      {(customer.city || customer.country) && (
                        <div className="text-xs text-gray-500 mt-1">
                          {customer.city}{customer.city && customer.country ? ', ' : ''}{customer.country}
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
    </div>
  );
}
