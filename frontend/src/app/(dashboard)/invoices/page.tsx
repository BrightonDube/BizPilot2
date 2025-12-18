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
  Calendar,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name?: string;
  customer_id: string | null;
  status: string;
  subtotal: number | string;
  tax_amount: number | string;
  discount_amount: number | string;
  total: number | string;
  amount_paid: number | string;
  balance_due: number | string;
  issue_date: string;
  due_date: string;
  is_overdue?: boolean;
  created_at: string;
}

interface InvoiceListResponse {
  items: Invoice[];
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

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoices() {
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
        
        if (selectedStatus !== 'all') {
          params.append('status', selectedStatus);
        }
        
        const response = await apiClient.get<InvoiceListResponse>(`/invoices?${params}`);
        setInvoices(response.data.items);
        setTotal(response.data.total);
        setPages(response.data.pages);
      } catch (err) {
        console.error('Failed to fetch invoices:', err);
        setError('Failed to load invoices');
      } finally {
        setIsLoading(false);
      }
    }

    // Debounce search
    const timeoutId = setTimeout(fetchInvoices, 300);
    return () => clearTimeout(timeoutId);
  }, [page, searchTerm, selectedStatus]);

  const filteredInvoices = invoices;

  const totalInvoices = total;
  const totalAmount = invoices.reduce((sum, i) => sum + toNumber(i.total), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + toNumber(i.amount_paid), 0);
  const overdueInvoices = invoices.filter(i => i.status === 'overdue' || i.is_overdue);
  const overdueAmount = overdueInvoices.reduce((sum, i) => {
    const balanceDue = toNumber(i.balance_due);
    if (balanceDue > 0) return sum + balanceDue;
    return sum + (toNumber(i.total) - toNumber(i.amount_paid));
  }, 0);

  if (isLoading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading invoices...</p>
        </div>
      </div>
    );
  }

  if (error && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold text-white">Unable to load invoices</h2>
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
        title="Invoices"
        description={`Create and manage invoices (${totalInvoices} invoices)`}
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
          value={formatCurrency(totalAmount)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Collected"
          value={formatCurrency(totalPaid)}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <StatCard
          title="Overdue"
          value={formatCurrency(overdueAmount)}
          icon={<AlertCircle className="w-5 h-5" />}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <label htmlFor="invoice-status-filter" className="sr-only">Filter by invoice status</label>
        <select
          id="invoice-status-filter"
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
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
          description="Try adjusting your search or filters"
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
            const totalValue = toNumber(invoice.total);
            const paidValue = toNumber(invoice.amount_paid);
            const balanceDue = toNumber(invoice.balance_due) || (totalValue - paidValue);
            const isOverdue = invoice.is_overdue || invoice.status === 'overdue';
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
                            <Badge variant={isOverdue ? 'danger' : invoice.status === 'paid' ? 'success' : 'secondary'}>
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">{invoice.customer_name || 'Walk-in Customer'}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Issued: {formatDate(invoice.issue_date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Due: {formatDate(invoice.due_date)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">
                          {formatCurrency(totalValue)}
                        </div>
                        {balanceDue > 0 && (
                          <div className={`text-sm ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                            Due: {formatCurrency(balanceDue)}
                          </div>
                        )}
                        {paidValue > 0 && paidValue < totalValue && (
                          <div className="text-xs text-green-400">
                            Paid: {formatCurrency(paidValue)}
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

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-400">
            Page {page} of {pages} ({total} invoices)
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
