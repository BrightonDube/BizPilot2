'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  PageHeader,
  LoadingSpinner,
} from '@/components/ui';
import {
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------
 * Types
 * ----------------------------------------------------------------*/

interface PaymentMethod {
  id: string;
  business_id: string;
  name: string;
  method_type: string;
  provider: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

/* ------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------*/

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  cash: Banknote,
  card: CreditCard,
  eft: Wallet,
  mobile: Smartphone,
  snapscan: Smartphone,
  gift_card: Wallet,
  account: Wallet,
};

const METHOD_COLORS: Record<string, string> = {
  cash: 'bg-green-600/20 text-green-400',
  card: 'bg-blue-600/20 text-blue-400',
  eft: 'bg-purple-600/20 text-purple-400',
  mobile: 'bg-orange-600/20 text-orange-400',
  snapscan: 'bg-yellow-600/20 text-yellow-400',
  gift_card: 'bg-pink-600/20 text-pink-400',
  account: 'bg-gray-600/20 text-gray-400',
};

/* ------------------------------------------------------------------
 * Component
 * ----------------------------------------------------------------*/

export default function PaymentsPageClient() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('cash');
  const [newProvider, setNewProvider] = useState('');

  const fetchMethods = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<PaymentMethod>>(
        '/api/v1/payments/methods',
        { params: { active_only: false } }
      );
      setMethods(res.data.items);
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const handleCreate = async () => {
    if (!newName) return;
    try {
      await apiClient.post('/api/v1/payments/methods', {
        name: newName,
        method_type: newType,
        provider: newProvider || undefined,
      });
      setNewName('');
      setNewProvider('');
      setShowCreate(false);
      fetchMethods();
    } catch (err) {
      console.error('Failed to create method:', err);
    }
  };

  const handleToggle = async (method: PaymentMethod) => {
    try {
      await apiClient.patch(`/api/v1/payments/methods/${method.id}`, {
        is_active: !method.is_active,
      });
      fetchMethods();
    } catch (err) {
      console.error('Failed to toggle method:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payment method?')) return;
    try {
      await apiClient.delete(`/api/v1/payments/methods/${id}`);
      fetchMethods();
    } catch (err) {
      console.error('Failed to delete method:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Methods"
        description="Configure accepted payment methods for your business"
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Methods</p>
            <p className="text-2xl font-bold text-gray-200">{methods.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-400">
              {methods.filter((m) => m.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Inactive</p>
            <p className="text-2xl font-bold text-gray-500">
              {methods.filter((m) => !m.is_active).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Method
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-300">
              Add Payment Method
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Name (e.g. Card Terminal #1)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="eft">EFT</option>
                <option value="snapscan">SnapScan</option>
                <option value="mobile">Mobile</option>
                <option value="gift_card">Gift Card</option>
                <option value="account">Account</option>
              </select>
              <Input
                placeholder="Provider (optional)"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
              />
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Methods grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {methods.map((method) => {
          const Icon = METHOD_ICONS[method.method_type] || CreditCard;
          const colorClass =
            METHOD_COLORS[method.method_type] || 'bg-gray-600/20 text-gray-400';

          return (
            <Card key={method.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${colorClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {method.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {method.method_type}
                        {method.provider && ` · ${method.provider}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggle(method)}
                      className={`p-1 rounded ${
                        method.is_active
                          ? 'text-green-400 hover:text-green-300'
                          : 'text-gray-500 hover:text-gray-400'
                      }`}
                      title={method.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {method.is_active ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(method.id)}
                      className="p-1 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <Badge
                    variant={method.is_active ? 'success' : 'secondary'}
                    className="text-xs"
                  >
                    {method.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {methods.length === 0 && (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No payment methods configured</p>
          <p className="text-sm text-gray-600">
            Add your first payment method to start accepting payments
          </p>
        </div>
      )}
    </div>
  );
}
