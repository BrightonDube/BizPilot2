'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Bell, Check, CheckCheck, Settings, Trash2, Info, AlertTriangle, AlertCircle, ShoppingCart, Package, CreditCard, Monitor } from 'lucide-react';

type Tab = 'notifications' | 'preferences';

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

interface Preferences {
  order_notifications: boolean;
  inventory_alerts: boolean;
  payment_notifications: boolean;
  system_notifications: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-blue-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  success: <Check className="w-4 h-4 text-green-500" />,
  order: <ShoppingCart className="w-4 h-4 text-purple-500" />,
  inventory: <Package className="w-4 h-4 text-orange-500" />,
  payment: <CreditCard className="w-4 h-4 text-emerald-500" />,
  system: <Monitor className="w-4 h-4 text-gray-500" />,
};

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterRead, setFilterRead] = useState<string>('');

  const fetchNotifications = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page, per_page: 20 };
      if (filterRead === 'unread') params.is_read = 'false';
      if (filterRead === 'read') params.is_read = 'true';
      const res = await apiClient.get('/notifications/', { params });
      setNotifications(res.data.items || res.data);
      setTotal(res.data.total || 0);
    } catch { /* ignore */ }
  }, [page, filterRead]);

  const fetchUnreadCount = useCallback(async () => {
    try { const res = await apiClient.get('/notifications/unread-count'); setUnreadCount(res.data.count || res.data.unread_count || 0); } catch { /* ignore */ }
  }, []);

  const fetchPreferences = useCallback(async () => {
    try { const res = await apiClient.get('/notifications/preferences'); setPreferences(res.data); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchNotifications(), fetchUnreadCount(), fetchPreferences()]);
      setLoading(false);
    };
    load();
  }, [fetchNotifications, fetchUnreadCount, fetchPreferences]);

  const markAsRead = async (id: string) => {
    try { await apiClient.patch(`/notifications/${id}/read`); fetchNotifications(); fetchUnreadCount(); } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try { await apiClient.post('/notifications/mark-all-read'); fetchNotifications(); fetchUnreadCount(); } catch { /* ignore */ }
  };

  const deleteNotification = async (id: string) => {
    try { await apiClient.delete(`/notifications/${id}`); fetchNotifications(); fetchUnreadCount(); } catch { /* ignore */ }
  };

  const updatePreference = async (key: keyof Preferences, value: boolean) => {
    if (!preferences) return;
    try {
      const updated = { ...preferences, [key]: value };
      await apiClient.put('/notifications/preferences', updated);
      setPreferences(updated);
    } catch { /* ignore */ }
  };

  const formatDate = (d: string) => {
    const now = new Date();
    const date = new Date(d);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-ZA');
  };

  const totalPages = Math.ceil(total / 20);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" /> Notifications
          {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
        </h1>
        <div className="flex gap-2">
          {tab === 'notifications' && unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setTab('notifications')} className={`flex items-center gap-2 px-4 py-2 border-b-2 ${tab === 'notifications' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
          <Bell className="w-4 h-4" /> All ({total})
        </button>
        <button onClick={() => setTab('preferences')} className={`flex items-center gap-2 px-4 py-2 border-b-2 ${tab === 'preferences' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
          <Settings className="w-4 h-4" /> Preferences
        </button>
      </div>

      {tab === 'notifications' && (
        <>
          <div className="flex gap-2 mb-4">
            <select value={filterRead} onChange={e => { setFilterRead(e.target.value); setPage(1); }} className="border rounded-lg p-2 text-sm">
              <option value="">All</option><option value="unread">Unread</option><option value="read">Read</option>
            </select>
          </div>

          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className={`bg-white rounded-lg shadow p-4 flex gap-3 ${!n.is_read ? 'border-l-4 border-blue-500' : ''}`}>
                <div className="mt-0.5">{TYPE_ICONS[n.notification_type] || TYPE_ICONS.info}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium text-gray-700'}`}>{n.title}</h3>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{formatDate(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  {n.action_url && <a href={n.action_url} className="text-xs text-blue-600 hover:underline mt-1 inline-block">View →</a>}
                </div>
                <div className="flex flex-col gap-1">
                  {!n.is_read && (
                    <button onClick={() => markAsRead(n.id)} className="text-gray-400 hover:text-blue-500" title="Mark read"><Check className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => deleteNotification(n.id)} className="text-gray-400 hover:text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {!notifications.length && (
              <div className="text-center py-12 text-gray-400">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50 text-sm">Prev</button>
              <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-50 text-sm">Next</button>
            </div>
          )}
        </>
      )}

      {tab === 'preferences' && preferences && (
        <div className="bg-white rounded-lg shadow p-6 max-w-xl">
          <h3 className="font-medium mb-4">Notification Preferences</h3>
          <div className="space-y-4">
            {([
              ['order_notifications', 'Order Notifications', 'Get notified about new orders and status changes'],
              ['inventory_alerts', 'Inventory Alerts', 'Low stock and reorder alerts'],
              ['payment_notifications', 'Payment Notifications', 'Payment received and overdue reminders'],
              ['system_notifications', 'System Notifications', 'System updates and maintenance'],
              ['email_enabled', 'Email Notifications', 'Receive notifications via email'],
              ['push_enabled', 'Push Notifications', 'Browser push notifications'],
            ] as const).map(([key, label, desc]) => (
              <div key={key} className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences[key]}
                    onChange={e => updatePreference(key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
