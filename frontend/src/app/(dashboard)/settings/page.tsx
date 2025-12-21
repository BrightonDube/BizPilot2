'use client';

/**
 * Settings page - Business and user settings.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Settings as SettingsIcon,
  User,
  Building2,
  Bell,
  Shield,
  CreditCard,
  Palette,
  Globe,
  Save,
  Camera,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { CurrencySelector } from '@/components/common/CurrencySelector';
import { LanguageSelector } from '@/components/common/LanguageSelector';

type SettingsTab = 'profile' | 'business' | 'notifications' | 'security' | 'billing' | 'appearance';

interface TabConfig {
  id: SettingsTab;
  name: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'profile', name: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'business', name: 'Business', icon: <Building2 className="w-4 h-4" /> },
  { id: 'notifications', name: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'security', name: 'Security', icon: <Shield className="w-4 h-4" /> },
  { id: 'billing', name: 'Billing', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'appearance', name: 'Appearance', icon: <Palette className="w-4 h-4" /> },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabParam || 'profile');
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  const [businessData, setBusinessData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    tax_id: '',
    currency: 'ZAR',
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await apiClient.put('/users/me', profileData);
      // Show success message
    } catch (error) {
      // Handle error
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBusiness = async () => {
    setIsSaving(true);
    try {
      await apiClient.put('/businesses/current', businessData);
      // Show success message
    } catch (error) {
      // Handle error
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and business settings"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      activeTab === tab.id
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    <span className="text-sm font-medium">{tab.name}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-400" />
                  </div>
                  <Button variant="outline" className="border-gray-700">
                    <Camera className="w-4 h-4 mr-2" />
                    Change Avatar
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-400 mb-1">
                      First Name
                    </label>
                    <Input
                      id="first_name"
                      value={profileData.first_name}
                      onChange={(e) =>
                        setProfileData({ ...profileData, first_name: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-gray-400 mb-1">
                      Last Name
                    </label>
                    <Input
                      id="last_name"
                      value={profileData.last_name}
                      onChange={(e) =>
                        setProfileData({ ...profileData, last_name: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) =>
                        setProfileData({ ...profileData, email: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                      disabled
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-400 mb-1">
                      Phone
                    </label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData({ ...profileData, phone: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Business Settings */}
          {activeTab === 'business' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Business Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="business_name" className="block text-sm font-medium text-gray-400 mb-1">
                      Business Name
                    </label>
                    <Input
                      id="business_name"
                      value={businessData.name}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, name: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="business_email" className="block text-sm font-medium text-gray-400 mb-1">
                      Business Email
                    </label>
                    <Input
                      id="business_email"
                      type="email"
                      value={businessData.email}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, email: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="business_phone" className="block text-sm font-medium text-gray-400 mb-1">
                      Business Phone
                    </label>
                    <Input
                      id="business_phone"
                      value={businessData.phone}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, phone: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-400 mb-1">
                      Address
                    </label>
                    <Input
                      id="address"
                      value={businessData.address}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, address: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-400 mb-1">
                      City
                    </label>
                    <Input
                      id="city"
                      value={businessData.city}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, city: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-gray-400 mb-1">
                      Country
                    </label>
                    <Input
                      id="country"
                      value={businessData.country}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, country: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="tax_id" className="block text-sm font-medium text-gray-400 mb-1">
                      Tax ID / VAT Number
                    </label>
                    <Input
                      id="tax_id"
                      value={businessData.tax_id}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, tax_id: e.target.value })
                      }
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="currency" className="block text-sm font-medium text-gray-400 mb-1">
                      Default Currency
                    </label>
                    <CurrencySelector
                      value={businessData.currency}
                      onChange={(currencyCode) =>
                        setBusinessData({ ...businessData, currency: currencyCode })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveBusiness}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'email_orders', label: 'New order notifications', description: 'Receive email when a new order is placed' },
                  { id: 'email_payments', label: 'Payment notifications', description: 'Receive email when a payment is received' },
                  { id: 'email_inventory', label: 'Low stock alerts', description: 'Receive email when inventory is running low' },
                  { id: 'email_reports', label: 'Weekly reports', description: 'Receive weekly business summary reports' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <h3 className="text-sm font-medium text-white mb-2">Change Password</h3>
                  <div className="space-y-3">
                    <Input
                      type="password"
                      placeholder="Current password"
                      className="bg-gray-800 border-gray-700"
                    />
                    <Input
                      type="password"
                      placeholder="New password"
                      className="bg-gray-800 border-gray-700"
                    />
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      className="bg-gray-800 border-gray-700"
                    />
                    <Button variant="outline" className="border-gray-700">
                      Update Password
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <h3 className="text-sm font-medium text-white mb-2">Two-Factor Authentication</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Add an extra layer of security to your account
                  </p>
                  <Button variant="outline" className="border-gray-700">
                    Enable 2FA
                  </Button>
                </div>

                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <h3 className="text-sm font-medium text-white mb-2">Active Sessions</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Manage devices that are logged into your account
                  </p>
                  <Button variant="outline" className="border-gray-700">
                    View Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Billing Settings */}
          {activeTab === 'billing' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Billing & Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-white">Free Plan</h3>
                      <p className="text-sm text-gray-400">You are currently on the free plan</p>
                    </div>
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                      Upgrade
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <h3 className="text-sm font-medium text-white mb-2">Payment Methods</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    No payment methods added
                  </p>
                  <Button variant="outline" className="border-gray-700">
                    Add Payment Method
                  </Button>
                </div>

                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <h3 className="text-sm font-medium text-white mb-2">Billing History</h3>
                  <p className="text-xs text-gray-400">
                    No billing history available
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Theme</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {['Dark', 'Light', 'System'].map((theme) => (
                      <button
                        key={theme}
                        className={`p-4 rounded-lg border transition-colors ${
                          theme === 'Dark'
                            ? 'bg-blue-600/20 border-blue-500'
                            : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <span className="text-sm text-white">{theme}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Language</h3>
                  <LanguageSelector className="w-full" />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Date Format</h3>
                  <label htmlFor="date-format-select" className="sr-only">Select date format</label>
                  <select
                    id="date-format-select"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
