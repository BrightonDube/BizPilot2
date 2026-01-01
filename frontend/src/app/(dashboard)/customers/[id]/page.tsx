'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  User,
  AlertTriangle,
} from 'lucide-react';

import { apiClient } from '@/lib/api';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { formatCurrency } from '@/lib/utils';

interface CustomerResponse {
  id: string;
  business_id: string;
  customer_type: 'individual' | 'business';
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  tax_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  notes?: string | null;
  tags: string[];
  display_name: string;
  full_address: string;
  total_orders: number;
  total_spent: number;
  average_order_value: number;
  created_at: string;
  updated_at: string;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCustomer() {
      try {
        setLoading(true);
        setError(null);
        const resp = await apiClient.get<CustomerResponse>(`/customers/${customerId}`);
        setCustomer(resp.data);
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    }

    if (customerId) {
      fetchCustomer();
    }
  }, [customerId]);

  const title = useMemo(() => {
    if (!customer) return 'Customer';
    return customer.display_name || 'Customer';
  }, [customer]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-gray-300">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p>Loading customer...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Customer"
          description="Customer details"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          }
        />
        <EmptyState
          title="Unable to load customer"
          description={error}
          icon={<AlertTriangle className="w-8 h-8 text-yellow-400" />}
          action={
            <Button onClick={() => router.refresh()}>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={customer.customer_type === 'business' ? 'Business customer' : 'Individual customer'}
        actions={
          <Link href="/customers">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Orders"
          value={String(customer.total_orders || 0)}
          icon={<User className="w-5 h-5" />}
        />
        <StatCard
          title="Total Spent"
          value={formatCurrency(customer.total_spent || 0)}
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Order"
          value={formatCurrency(customer.average_order_value || 0)}
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          title="Customer Type"
          value={customer.customer_type === 'business' ? 'Business' : 'Individual'}
          icon={customer.customer_type === 'business' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-gray-900/60 border-gray-800 lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  customer.customer_type === 'business'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {customer.customer_type === 'business' ? (
                  <Building2 className="w-6 h-6" />
                ) : (
                  <User className="w-6 h-6" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-white truncate">{title}</h2>
                  <Badge variant="secondary">{customer.customer_type}</Badge>
                </div>
                {customer.company_name && customer.first_name && (
                  <p className="text-sm text-gray-400">
                    Contact: {customer.first_name} {customer.last_name}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Contact</h3>
                {customer.email ? (
                  <div className="flex items-center gap-2 text-sm text-gray-300 min-w-0">
                    <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No email</p>
                )}
                {customer.phone ? (
                  <div className="flex items-center gap-2 text-sm text-gray-300 min-w-0">
                    <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">{customer.phone}</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No phone</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Address</h3>
                {customer.full_address ? (
                  <div className="flex items-start gap-2 text-sm text-gray-300">
                    <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                    <p className="text-gray-200 leading-relaxed">{customer.full_address}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No address</p>
                )}
              </div>
            </div>

            {customer.notes && (
              <div className="pt-4 border-t border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-2">Notes</h3>
                <p className="text-gray-200 whitespace-pre-wrap text-sm">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900/60 border-gray-800">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Metadata</h3>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-400">Customer ID</span>
                <span className="text-gray-200 font-mono text-xs truncate" title={customer.id}>
                  {customer.id}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-400">Created</span>
                <span className="text-gray-200">{formatDate(customer.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-400">Updated</span>
                <span className="text-gray-200">{formatDate(customer.updated_at)}</span>
              </div>
            </div>

            {customer.tags?.length > 0 && (
              <div className="pt-4 border-t border-gray-800">
                <h4 className="text-sm font-semibold text-white mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
