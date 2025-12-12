'use client';

import { useState } from 'react';
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
import { Button, Input, Card, CardContent } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';

// Mock data for customers
const mockCustomers = [
  {
    id: '1',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    company_name: null,
    customer_type: 'individual',
    total_orders: 12,
    total_spent: 1450.00,
    tags: ['vip', 'repeat'],
    city: 'New York',
    country: 'USA',
  },
  {
    id: '2',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@acme.com',
    phone: '+1 (555) 987-6543',
    company_name: 'Acme Corporation',
    customer_type: 'business',
    total_orders: 45,
    total_spent: 12500.00,
    tags: ['wholesale', 'vip'],
    city: 'Los Angeles',
    country: 'USA',
  },
  {
    id: '3',
    first_name: 'Robert',
    last_name: 'Johnson',
    email: 'robert.j@email.com',
    phone: '+1 (555) 456-7890',
    company_name: null,
    customer_type: 'individual',
    total_orders: 3,
    total_spent: 250.00,
    tags: [],
    city: 'Chicago',
    country: 'USA',
  },
  {
    id: '4',
    first_name: 'Sarah',
    last_name: 'Williams',
    email: 'sarah@techstart.io',
    phone: '+1 (555) 321-0987',
    company_name: 'TechStart Inc',
    customer_type: 'business',
    total_orders: 28,
    total_spent: 8750.00,
    tags: ['tech', 'wholesale'],
    city: 'San Francisco',
    country: 'USA',
  },
];

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const filteredCustomers = mockCustomers.filter(customer => {
    const matchesSearch = 
      customer.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesType = selectedType === 'all' || customer.customer_type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const totalCustomers = mockCustomers.length;
  const totalRevenue = mockCustomers.reduce((sum, c) => sum + c.total_spent, 0);
  const businessCustomers = mockCustomers.filter(c => c.customer_type === 'business').length;
  const avgOrderValue = totalRevenue / mockCustomers.reduce((sum, c) => sum + c.total_orders, 0) || 0;

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
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Business Customers"
          value={businessCustomers}
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Order Value"
          value={`$${avgOrderValue.toFixed(2)}`}
          icon={<ShoppingCart className="w-5 h-5" />}
          trend={{ value: 5, isPositive: true }}
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
          description="Try adjusting your search or filters"
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
                            {customer.company_name || `${customer.first_name} ${customer.last_name}`}
                          </h3>
                          {customer.tags.includes('vip') && (
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
                            {customer.email}
                          </span>
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {customer.phone}
                            </span>
                          )}
                        </div>
                        {customer.tags.length > 0 && (
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
                        ${customer.total_spent.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400">
                        {customer.total_orders} orders
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {customer.city}, {customer.country}
                      </div>
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
