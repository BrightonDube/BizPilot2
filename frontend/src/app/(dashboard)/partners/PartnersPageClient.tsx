'use client';

/**
 * Partner administration page.
 *
 * Manages partner organisations, their configurations, white-label
 * branding, and user access.  Platform admins use this page to
 * onboard and manage resellers.
 *
 * Why a separate admin page?
 * Partners are a platform-level concept that spans multiple businesses.
 * Keeping partner admin isolated prevents accidental exposure of
 * cross-tenant data to regular business users.
 */

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
  Building2,
  Users,
  Palette,
  Settings,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Partner {
  id: string;
  partner_name: string;
  partner_identifier: string;
  partner_slug: string;
  company_name: string | null;
  status: string;
  subscription_tier: string | null;
  user_limit: number | null;
  location_limit: number | null;
  billing_cycle: string;
  billing_currency: string;
  revenue_share_percentage: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnersPageClient() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formIdentifier, setFormIdentifier] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCompany, setFormCompany] = useState('');

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/partners');
      setPartners(res.data.items || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load partners';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleCreate = async () => {
    if (!formName.trim() || !formIdentifier.trim() || !formSlug.trim()) return;
    try {
      await apiClient.post('/api/v1/partners', {
        partner_name: formName,
        partner_identifier: formIdentifier,
        partner_slug: formSlug,
        company_name: formCompany || null,
      });
      setFormName('');
      setFormIdentifier('');
      setFormSlug('');
      setFormCompany('');
      setShowCreateForm(false);
      fetchPartners();
    } catch {
      setError('Failed to create partner');
    }
  };

  const handleDelete = async (partnerId: string) => {
    try {
      await apiClient.delete(`/api/v1/partners/${partnerId}`);
      setSelectedPartner(null);
      fetchPartners();
    } catch {
      setError('Failed to delete partner');
    }
  };

  // Auto-generate slug from identifier
  const handleIdentifierChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormIdentifier(cleaned);
    setFormSlug(cleaned);
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'secondary'> = {
      active: 'success',
      pending: 'warning',
      suspended: 'danger',
      terminated: 'secondary',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
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
        title="Partner Admin"
        description="Manage reseller partners, branding, and configurations"
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {partners.length} partner(s)
        </span>
        <Button size="sm" onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Partner
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Onboard New Partner
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Partner Name
                </label>
                <Input
                  value={formName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                  placeholder="Acme Resellers"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Identifier (lowercase, no spaces)
                </label>
                <Input
                  value={formIdentifier}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleIdentifierChange(e.target.value)
                  }
                  placeholder="acme-resellers"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  URL Slug
                </label>
                <Input
                  value={formSlug}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormSlug(e.target.value)}
                  placeholder="acme-resellers"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Company Name (optional)
                </label>
                <Input
                  value={formCompany}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormCompany(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate}>
                Create Partner
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partner list */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {partners.map((p) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition-colors ${
              selectedPartner?.id === p.id
                ? 'border-blue-500'
                : 'hover:border-gray-600'
            }`}
            onClick={() => setSelectedPartner(p)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-400" />
                  <span className="font-medium text-white">
                    {p.partner_name}
                  </span>
                </div>
                {statusBadge(p.status)}
              </div>
              {p.company_name && (
                <p className="text-sm text-gray-400">{p.company_name}</p>
              )}
              <div className="flex gap-3 mt-2 text-xs text-gray-500">
                <span className="font-mono">{p.partner_identifier}</span>
                <span>{p.billing_cycle}</span>
                {p.subscription_tier && <span>{p.subscription_tier}</span>}
              </div>
              {(p.user_limit || p.location_limit) && (
                <div className="flex gap-2 mt-2">
                  {p.user_limit && (
                    <Badge variant="secondary">
                      {p.user_limit} users
                    </Badge>
                  )}
                  {p.location_limit && (
                    <Badge variant="secondary">
                      {p.location_limit} locations
                    </Badge>
                  )}
                </div>
              )}
              {p.revenue_share_percentage && (
                <p className="text-xs text-gray-500 mt-1">
                  Revenue share: {p.revenue_share_percentage}%
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {partners.length === 0 && (
          <p className="text-gray-500 col-span-full text-center py-8">
            No partners yet. Click &quot;New Partner&quot; to onboard one.
          </p>
        )}
      </div>

      {/* Selected partner detail */}
      {selectedPartner && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {selectedPartner.partner_name}
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPartner(null)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400"
                  onClick={() => handleDelete(selectedPartner.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Identifier:</span>{' '}
                <span className="text-white font-mono">
                  {selectedPartner.partner_identifier}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Slug:</span>{' '}
                <span className="text-white font-mono">
                  {selectedPartner.partner_slug}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Status:</span>{' '}
                {statusBadge(selectedPartner.status)}
              </div>
              <div>
                <span className="text-gray-400">Billing:</span>{' '}
                <span className="text-white">
                  {selectedPartner.billing_cycle} ({selectedPartner.billing_currency})
                </span>
              </div>
              <div>
                <span className="text-gray-400">Created:</span>{' '}
                <span className="text-white">
                  {new Date(selectedPartner.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
