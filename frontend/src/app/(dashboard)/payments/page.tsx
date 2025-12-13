'use client';

/**
 * Payments page - Track and manage payment records.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Input,
  Card,
  CardContent,
  Badge,
  StatCard,
  EmptyState,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

interface Payment {
  id: string;
  payment_number: string;
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  payment_method: string;
  status: string;
  payment_date: string;
  reference: string | null;
}

const statusConfig: Record<string, { color: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  completed: { color: 'success', label: 'Completed' },
  pending: { color: 'warning', label: 'Pending' },
  failed: { color: 'danger', label: 'Failed' },
  refunded: { color: 'default', label: 'Refunded' },
};

const methodIcons: Record<string, string> = {
  cash: '💵',
  card: '💳',
  bank_transfer: '🏦',
  mobile: '📱',
  check: '📄',
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await apiClient.get('/payments');
      setPayments(response.data.items || []);
    } catch (error) {
      // Use empty array if API is not available
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.payment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || payment.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalReceived = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingAmount = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const completedCount = payments.filter((p) => p.status === 'completed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Track and manage payment records"
        actions={
          <Link href="/payments/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Received"
          value={`R ${totalReceived.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          changeType="positive"
        />
        <StatCard
          title="Pending"
          value={`R ${pendingAmount.toLocaleString()}`}
          icon={<Clock className="w-5 h-5" />}
          changeType="neutral"
        />
        <StatCard
          title="Completed"
          value={completedCount}
          icon={<CheckCircle className="w-5 h-5" />}
          changeType="positive"
        />
        <StatCard
          title="This Month"
          value={`R ${totalReceived.toLocaleString()}`}
          icon={<TrendingUp className="w-5 h-5" />}
          change="+12.5%"
          changeType="positive"
        />
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <label htmlFor="payment-status-filter" className="sr-only">Filter by payment status</label>
        <select
          id="payment-status-filter"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <Button variant="outline" className="border-gray-700">
          <Filter className="w-4 h-4 mr-2" />
          More Filters
        </Button>
      </div>

      {/* Payments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments found"
          description={payments.length === 0 
            ? "Record your first payment to get started"
            : "Try adjusting your search or filters"
          }
          action={
            <Link href="/payments/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                Record Payment
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredPayments.map((payment) => {
            const status = statusConfig[payment.status] || statusConfig.pending;
            return (
              <Card key={payment.id} className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <span className="text-lg">
                          {methodIcons[payment.payment_method] || '💰'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{payment.payment_number}</h3>
                          <Badge variant={status.color}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-gray-400">{payment.customer_name}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            {payment.invoice_number}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {payment.payment_date}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-green-400">
                        +R {payment.amount?.toLocaleString() || '0'}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {payment.payment_method?.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
