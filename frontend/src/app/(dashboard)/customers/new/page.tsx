'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Building2 } from 'lucide-react';
import Link from 'next/link';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { PageHeader } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

export default function NewCustomerPage() {
  const router = useRouter();
  const [customerType, setCustomerType] = useState<'individual' | 'business'>('individual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    tax_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    notes: '',
    tags: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        customer_type: customerType,
        first_name: formData.first_name || undefined,
        last_name: formData.last_name || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        company_name: formData.company_name || undefined,
        tax_number: formData.tax_number || undefined,
        address_line1: formData.address_line1 || undefined,
        address_line2: formData.address_line2 || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        postal_code: formData.postal_code || undefined,
        country: formData.country || undefined,
        notes: formData.notes || undefined,
        tags: formData.tags
          ? formData.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      };

      await apiClient.post('/customers', payload);
      router.push('/customers');
    } catch (err) {
      console.error('Failed to create customer:', err);
      setError('Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <PageHeader
          title="Add Customer"
          description="Create a new customer record"
        />
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>Customer Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setCustomerType('individual')}
                className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                  customerType === 'individual'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <User className={`w-8 h-8 mx-auto mb-2 ${
                  customerType === 'individual' ? 'text-blue-400' : 'text-gray-400'
                }`} />
                <div className={`font-medium ${
                  customerType === 'individual' ? 'text-white' : 'text-gray-400'
                }`}>Individual</div>
                <div className="text-sm text-gray-500">Personal customer</div>
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('business')}
                className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                  customerType === 'business'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Building2 className={`w-8 h-8 mx-auto mb-2 ${
                  customerType === 'business' ? 'text-purple-400' : 'text-gray-400'
                }`} />
                <div className={`font-medium ${
                  customerType === 'business' ? 'text-white' : 'text-gray-400'
                }`}>Business</div>
                <div className="text-sm text-gray-500">Company or organization</div>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customerType === 'business' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Company Name *</label>
                  <Input name="company_name" value={formData.company_name} onChange={handleChange} placeholder="Acme Corporation" className="bg-gray-700 border-gray-600" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tax Number</label>
                  <Input name="tax_number" value={formData.tax_number} onChange={handleChange} placeholder="VAT123456" className="bg-gray-700 border-gray-600" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">First Name {customerType === 'individual' && '*'}</label>
                <Input name="first_name" value={formData.first_name} onChange={handleChange} placeholder="John" className="bg-gray-700 border-gray-600" required={customerType === 'individual'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Last Name {customerType === 'individual' && '*'}</label>
                <Input name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Doe" className="bg-gray-700 border-gray-600" required={customerType === 'individual'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <Input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" className="bg-gray-700 border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="+1 (555) 123-4567" className="bg-gray-700 border-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Address Line 1</label>
              <Input name="address_line1" value={formData.address_line1} onChange={handleChange} placeholder="123 Main Street" className="bg-gray-700 border-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Address Line 2</label>
              <Input name="address_line2" value={formData.address_line2} onChange={handleChange} placeholder="Suite 100" className="bg-gray-700 border-gray-600" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                <Input name="city" value={formData.city} onChange={handleChange} placeholder="New York" className="bg-gray-700 border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
                <Input name="state" value={formData.state} onChange={handleChange} placeholder="NY" className="bg-gray-700 border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Postal Code</label>
                <Input name="postal_code" value={formData.postal_code} onChange={handleChange} placeholder="10001" className="bg-gray-700 border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Country</label>
                <Input name="country" value={formData.country} onChange={handleChange} placeholder="USA" className="bg-gray-700 border-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href="/customers">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            Create Customer
          </Button>
        </div>
      </form>
    </div>
  );
}
