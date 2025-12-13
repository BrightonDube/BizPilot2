'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  DollarSign,
  Calendar
} from 'lucide-react';
import { Button, Input, Card, CardContent, LoadingSpinner } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  status: string;
  total: number;
  amount_paid: number;
  issue_date: string;
  due_date: string;
  is_overdue: boolean;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'bg-gray-500', icon: <FileText className="w-3 h-3" />, label: 'Draft' },
  sent: { color: 'bg-blue-500', icon: <Send className="w-3 h-3" />, label: 'Sent' },
  viewed: { color: 'bg-purple-500', icon: <FileText className="w-3 h-3" />, label: 'Viewed' },
  paid: { color: 'bg-green-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Paid' },
  partial: { color: 'bg-yellow-500', icon: <Clock className="w-3 h-3" />, label: 'Partial' },
  overdue: { color: 'bg-red-500', icon: <AlertCircle className="w-3 h-3" />, label: 'Overdue' },
  cancelled: { color: 'bg-gray-500', icon: <FileText className="w-3 h-3" />, label: 'Cancelled' },
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await apiClient.get('/invoices', {
        params: { limit: 50 },
      });
      setInvoices(response.data.items || []);
    } catch (error) {
      // Use empty array if API is not available
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || invoice.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + (i.amount_paid || 0), 0);
  const overdueCount = invoices.filter(i => i.is_overdue).length;
  const overdueAmount = invoices.filter(i => i.is_overdue).reduce((sum, i) => sum + ((i.total || 0) - (i.amount_paid || 0)), 0);

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
        title="Invoices"
        description="Create and manage invoices"
        actions={
          <Link href="/invoices/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoices"
          value={totalInvoices}
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard
          title="Total Amount"
          value={`R ${totalAmount.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Collected"
          value={`R ${totalPaid.toLocaleString()}`}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <StatCard
          title="Overdue"
          value={`R ${overdueAmount.toLocaleString()}`}
          icon={<AlertCircle className="w-5 h-5" />}
          trend={overdueCount > 0 ? { value: overdueCount, isPositive: false } : undefined}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <label htmlFor="invoice-status-filter" className="sr-only">Filter by invoice status</label>
        <select
          id="invoice-status-filter"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
        </select>
        <Button variant="outline" className="border-gray-700">
          <Filter className="w-4 h-4 mr-2" />
          More Filters
        </Button>
      </div>

      {filteredInvoices.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description={invoices.length === 0 
            ? "Create your first invoice to get started"
            : "Try adjusting your search or filters"
          }
          action={
            <Link href="/invoices/new">
              <Button>Create Your First Invoice</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map((invoice) => {
            const status = statusConfig[invoice.status] || statusConfig.draft;
            const balanceDue = (invoice.total || 0) - (invoice.amount_paid || 0);
            return (
              <Link key={invoice.id} href={`/invoices/${invoice.id}`}>
                <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full ${status.color} bg-opacity-20 flex items-center justify-center`}>
                          <span className={`${status.color.replace('bg-', 'text-')}`}>
                            {status.icon}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white">{invoice.invoice_number}</h3>
                            <Badge variant={invoice.is_overdue ? 'danger' : invoice.status === 'paid' ? 'success' : 'secondary'}>
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">{invoice.customer_name || 'Unknown Customer'}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Issued: {invoice.issue_date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Due: {invoice.due_date || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">
                          R {(invoice.total || 0).toLocaleString()}
                        </div>
                        {balanceDue > 0 && (
                          <div className={`text-sm ${invoice.is_overdue ? 'text-red-400' : 'text-gray-400'}`}>
                            Due: R {balanceDue.toLocaleString()}
                          </div>
                        )}
                        {(invoice.amount_paid || 0) > 0 && (invoice.amount_paid || 0) < (invoice.total || 0) && (
                          <div className="text-xs text-green-400">
                            Paid: R {(invoice.amount_paid || 0).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
