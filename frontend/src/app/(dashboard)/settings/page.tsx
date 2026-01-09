'use client';

/**
 * Settings page - Business and user settings.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Settings as SettingsIcon,
  User,
  Building2,
  Bell,
  Shield,
  CreditCard,
  Palette,
  Sparkles,
  Globe,
  Save,
  Camera,
  Check,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Crown,
  Zap,
  ExternalLink,
  Receipt,
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
import { useTheme } from '@/components/common/ThemeProvider';
import { subscriptionApi, SubscriptionTier, UserSubscription } from '@/lib/subscription-api';

type SettingsTab = 'profile' | 'business' | 'ai' | 'notifications' | 'security' | 'billing' | 'appearance';

type AISharingLevel =
  | 'none'
  | 'app_only'
  | 'metrics_only'
  | 'full_business'
  | 'full_business_with_customers';

type UserSettingsResponse = {
  ai_data_sharing_level: AISharingLevel;
};

interface TabConfig {
  id: SettingsTab;
  name: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'profile', name: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'business', name: 'Business', icon: <Building2 className="w-4 h-4" /> },
  { id: 'ai', name: 'AI', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'notifications', name: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'security', name: 'Security', icon: <Shield className="w-4 h-4" /> },
  { id: 'billing', name: 'Billing', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'appearance', name: 'Appearance', icon: <Palette className="w-4 h-4" /> },
];

interface BillingTransaction {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  tier_name?: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const billingProvider: 'payfast' | 'paystack' = 'payfast';
  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabParam || 'profile');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
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

  const [aiSharingLevel, setAiSharingLevel] = useState<AISharingLevel>('none');
  
  // Security state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  
  // Billing state
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingTransaction[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const resp = await apiClient.get<UserSettingsResponse>('/users/me/settings');
        const level = resp.data.ai_data_sharing_level;
        if (isMounted) {
          setAiSharingLevel(level || 'none');
        }
      } catch {
        // ignore
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load billing data when billing tab is active
  useEffect(() => {
    if (activeTab === 'billing') {
      loadBillingData();
    }
  }, [activeTab]);

  const loadBillingData = async () => {
    setLoadingBilling(true);
    try {
      const [subData, tiersData] = await Promise.all([
        subscriptionApi.getMySubscription(),
        subscriptionApi.getTiers(),
      ]);
      setSubscription(subData);
      setTiers(tiersData);
      
      // Try to load billing history
      try {
        const historyResp = await apiClient.get('/payments/transactions/me?limit=10');
        setBillingHistory(historyResp.data.items || []);
      } catch {
        // Billing history endpoint might not exist yet
        setBillingHistory([]);
      }
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleSaveAISettings = async () => {
    setIsSaving(true);
    try {
      await apiClient.put('/users/me/settings', {
        ai_data_sharing_level: aiSharingLevel,
      });
      setSuccessMessage('AI settings saved successfully');
    } catch {
      setErrorMessage('Failed to save AI settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Password validation
  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    return errors;
  };

  const handleChangePassword = async () => {
    setPasswordErrors([]);
    
    // Validate new password
    const validationErrors = validatePassword(passwordData.new_password);
    if (validationErrors.length > 0) {
      setPasswordErrors(validationErrors);
      return;
    }
    
    // Check passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordErrors(['New passwords do not match']);
      return;
    }
    
    // Check not same as current
    if (passwordData.current_password === passwordData.new_password) {
      setPasswordErrors(['New password must be different from current password']);
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post('/auth/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      setSuccessMessage('Password changed successfully');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setErrorMessage(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle tier upgrade
  const handleUpgrade = async (tier: SubscriptionTier) => {
    try {
      if (billingProvider === 'payfast' && tier.price_monthly_cents > 0) {
        setErrorMessage('Subscription upgrades are not available yet. Payfast integration is coming soon.');
        return;
      }

      const response = await subscriptionApi.selectTier(tier.id, selectedBillingCycle);
      
      if (response.requires_payment) {
        // Initiate Paystack checkout
        const checkoutResp = await apiClient.post('/payments/checkout/initiate', {
          tier_id: tier.id,
          billing_cycle: selectedBillingCycle,
        });
        
        // Redirect to Paystack
        if (checkoutResp.data.authorization_url) {
          window.location.href = checkoutResp.data.authorization_url;
        }
      } else {
        // Free tier - reload subscription data
        setSuccessMessage(`Successfully switched to ${tier.display_name}`);
        await loadBillingData();
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setErrorMessage(error.response?.data?.detail || 'Failed to upgrade subscription');
    }
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
      await apiClient.put('/business/current', businessData);
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

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400">{errorMessage}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      activeTab === tab.id
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <Button variant="outline">
                    <Camera className="w-4 h-4 mr-2" />
                    Change Avatar
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-muted-foreground mb-1">
                      First Name
                    </label>
                    <Input
                      id="first_name"
                      value={profileData.first_name}
                      onChange={(e) =>
                        setProfileData({ ...profileData, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-muted-foreground mb-1">
                      Last Name
                    </label>
                    <Input
                      id="last_name"
                      value={profileData.last_name}
                      onChange={(e) =>
                        setProfileData({ ...profileData, last_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) =>
                        setProfileData({ ...profileData, email: e.target.value })
                      }
                      disabled
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-1">
                      Phone
                    </label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData({ ...profileData, phone: e.target.value })
                      }
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

          {/* AI Settings */}
          {activeTab === 'ai' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  AI Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="text-sm font-medium text-foreground mb-2">AI Data Sharing Level</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Control how much of your business data BizPilot can share with the AI assistant.
                  </p>

                  <label htmlFor="ai-sharing" className="sr-only">AI Data Sharing Level</label>
                  <select
                    id="ai-sharing"
                    value={aiSharingLevel}
                    onChange={(e) => setAiSharingLevel(e.target.value as AISharingLevel)}
                    className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground"
                  >
                    <option value="none">None (no AI data)</option>
                    <option value="app_only">App only (how-to guidance)</option>
                    <option value="metrics_only">Metrics only (aggregated counts)</option>
                    <option value="full_business">Full business (products + inventory)</option>
                    <option value="full_business_with_customers">Full business + customers</option>
                  </select>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveAISettings}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Business Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="business_name" className="block text-sm font-medium text-muted-foreground mb-1">
                      Business Name
                    </label>
                    <Input
                      id="business_name"
                      value={businessData.name}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="business_email" className="block text-sm font-medium text-muted-foreground mb-1">
                      Business Email
                    </label>
                    <Input
                      id="business_email"
                      type="email"
                      value={businessData.email}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="business_phone" className="block text-sm font-medium text-muted-foreground mb-1">
                      Business Phone
                    </label>
                    <Input
                      id="business_phone"
                      value={businessData.phone}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-muted-foreground mb-1">
                      Address
                    </label>
                    <Input
                      id="address"
                      value={businessData.address}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, address: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-muted-foreground mb-1">
                      City
                    </label>
                    <Input
                      id="city"
                      value={businessData.city}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, city: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-muted-foreground mb-1">
                      Country
                    </label>
                    <Input
                      id="country"
                      value={businessData.country}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, country: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="tax_id" className="block text-sm font-medium text-muted-foreground mb-1">
                      Tax ID / VAT Number
                    </label>
                    <Input
                      id="tax_id"
                      value={businessData.tax_id}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, tax_id: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="currency" className="block text-sm font-medium text-muted-foreground mb-1">
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
            <Card>
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
                  <div key={item.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-border peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-background after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="text-sm font-medium text-foreground mb-2">Change Password</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Password must be at least 8 characters with uppercase, lowercase, number, and special character.
                  </p>
                  
                  {passwordErrors.length > 0 && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <ul className="text-sm text-red-400 list-disc list-inside space-y-1">
                        {passwordErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type={showPasswords.current ? 'text' : 'password'}
                        placeholder="Current password"
                        value={passwordData.current_password}
                        onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type={showPasswords.new ? 'text' : 'password'}
                        placeholder="New password"
                        value={passwordData.new_password}
                        onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleChangePassword}
                      disabled={isSaving || !passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="text-sm font-medium text-foreground mb-2">Two-Factor Authentication</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Add an extra layer of security to your account
                  </p>
                  <Button variant="outline">
                    Enable 2FA
                  </Button>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="text-sm font-medium text-foreground mb-2">Active Sessions</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Manage devices that are logged into your account
                  </p>
                  <Button variant="outline">
                    View Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Billing Settings */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              {loadingBilling ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {/* Current Plan */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Current Plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {subscription?.tier?.name === 'professional' ? (
                              <Crown className="w-8 h-8 text-yellow-400" />
                            ) : (
                              <Zap className="w-8 h-8 text-blue-400" />
                            )}
                            <div>
                              <h3 className="text-lg font-medium text-foreground">
                                {subscription?.tier?.display_name || 'Free Plan'}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Status: <span className={`font-medium ${
                                  subscription?.subscription_status === 'active' ? 'text-green-400' :
                                  subscription?.subscription_status === 'trial' ? 'text-yellow-400' :
                                  'text-muted-foreground'
                                }`}>
                                  {subscription?.subscription_status || 'Free'}
                                </span>
                              </p>
                              {subscription?.subscription_expires_at && (
                                <p className="text-xs text-muted-foreground">
                                  Expires: {formatDate(subscription.subscription_expires_at)}
                                </p>
                              )}
                              {subscription?.trial_ends_at && (
                                <p className="text-xs text-yellow-400">
                                  Trial ends: {formatDate(subscription.trial_ends_at)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Available Plans */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Available Plans</span>
                        <div className="flex bg-muted rounded-lg p-1">
                          <button
                            onClick={() => setSelectedBillingCycle('monthly')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                              selectedBillingCycle === 'monthly'
                                ? 'bg-blue-600 text-white'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Monthly
                          </button>
                          <button
                            onClick={() => setSelectedBillingCycle('yearly')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                              selectedBillingCycle === 'yearly'
                                ? 'bg-blue-600 text-white'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Yearly <span className="text-green-400 text-xs">Save 20%</span>
                          </button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {tiers.map((tier) => {
                          const price = selectedBillingCycle === 'monthly' 
                            ? tier.price_monthly_cents 
                            : tier.price_yearly_cents;
                          const monthlyEquivalent = selectedBillingCycle === 'yearly' 
                            ? Math.round(tier.price_yearly_cents / 12) 
                            : tier.price_monthly_cents;
                          const isCurrentTier = subscription?.tier?.id === tier.id;
                          const isProfessional = tier.name === 'professional';
                          const isPaid = price > 0;
                          const paidUpgradeDisabled = billingProvider === 'payfast' && isPaid;
                          
                          return (
                            <div
                              key={tier.id}
                              className={`relative p-4 rounded-lg border transition-all ${
                                isCurrentTier
                                  ? 'border-green-500 bg-green-900/10'
                                  : isProfessional
                                  ? 'border-purple-500/50 bg-purple-900/10 hover:border-purple-400'
                                  : 'border-border bg-muted hover:opacity-90'
                              }`}
                            >
                              {isProfessional && (
                                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                                  <span className="bg-gradient-to-r from-purple-600 to-blue-600 px-2 py-0.5 text-xs font-medium text-white rounded-full">
                                    Popular
                                  </span>
                                </div>
                              )}
                              {isCurrentTier && (
                                <div className="absolute top-2 right-2">
                                  <Check className="w-5 h-5 text-green-400" />
                                </div>
                              )}
                              
                              <h4 className="font-medium text-foreground mb-1">{tier.display_name}</h4>
                              <div className="mb-2">
                                <span className="text-2xl font-bold text-foreground">
                                  {formatPrice(monthlyEquivalent)}
                                </span>
                                {monthlyEquivalent > 0 && (
                                  <span className="text-muted-foreground text-sm">/mo</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">{tier.description}</p>
                              
                              <Button
                                size="sm"
                                className={`w-full ${
                                  isCurrentTier
                                    ? 'bg-green-600/20 text-green-400 border border-green-500/30 cursor-default'
                                    : isProfessional
                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600'
                                    : 'bg-muted hover:opacity-90'
                                }`}
                                onClick={() => !isCurrentTier && !paidUpgradeDisabled && handleUpgrade(tier)}
                                disabled={isCurrentTier || paidUpgradeDisabled}
                              >
                                {isCurrentTier
                                  ? 'Current Plan'
                                  : price === 0
                                  ? 'Select'
                                  : paidUpgradeDisabled
                                  ? 'Upgrade (Coming soon)'
                                  : 'Upgrade'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Billing History */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Receipt className="w-5 h-5" />
                        Billing History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {billingHistory.length > 0 ? (
                        <div className="space-y-2">
                          {billingHistory.map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {tx.tier_name || 'Subscription Payment'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(tx.created_at)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-foreground">
                                  {formatPrice(tx.amount_cents)}
                                </p>
                                <p className={`text-xs ${
                                  tx.status === 'success' ? 'text-green-400' :
                                  tx.status === 'pending' ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {tx.status}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No billing history available yet. Your transaction history will appear here once you make a purchase.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Theme</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {(['dark', 'light', 'system'] as const).map((themeOption) => (
                      <button
                        key={themeOption}
                        onClick={() => setTheme(themeOption)}
                        className={`p-4 rounded-lg border transition-colors ${
                          theme === themeOption
                            ? 'bg-blue-600/20 border-blue-500'
                            : 'bg-muted border-border hover:opacity-90'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          {themeOption === 'dark' && (
                            <div className="w-8 h-8 rounded-full bg-card border border-border" />
                          )}
                          {themeOption === 'light' && (
                            <div className="w-8 h-8 rounded-full bg-card border border-border" />
                          )}
                          {themeOption === 'system' && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-900 to-white border border-border" />
                          )}
                          <span className="text-sm text-foreground capitalize">{themeOption}</span>
                        </div>
                        {theme === themeOption && (
                          <Check className="w-4 h-4 text-blue-400 mx-auto mt-2" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {theme === 'system' 
                      ? 'Theme will automatically match your system preferences.'
                      : `Using ${theme} theme.`}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Language</h3>
                  <LanguageSelector className="w-full" />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Date Format</h3>
                  <label htmlFor="date-format-select" className="sr-only">Select date format</label>
                  <select
                    id="date-format-select"
                    className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground"
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
