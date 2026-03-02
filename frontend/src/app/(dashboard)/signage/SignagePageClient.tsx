'use client';

/**
 * Digital Signage management page.
 *
 * Provides CRUD for display groups, displays, content slides,
 * and playlists.  Uses tab-based navigation to organise sections.
 *
 * Why tabs instead of separate routes?
 * Signage management is a tightly coupled workflow — users typically
 * create content, build playlists, then assign them to displays in
 * one session.  Tabs keep everything in context.
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
  Monitor,
  Play,
  Film,
  Layout,
  Trash2,
  Edit,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DisplayGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Display {
  id: string;
  name: string;
  display_group_id: string | null;
  pairing_code: string | null;
  status: string;
  last_heartbeat_at: string | null;
}

interface Content {
  id: string;
  name: string;
  content_type: string;
  duration_seconds: number;
  status: string;
  published_at: string | null;
  created_at: string;
}

interface Playlist {
  id: string;
  name: string;
  shuffle: boolean;
  loop: boolean;
  priority: number;
  created_at: string;
}

type Tab = 'displays' | 'content' | 'playlists' | 'groups';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignagePageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('displays');
  const [groups, setGroups] = useState<DisplayGroup[]>([]);
  const [displays, setDisplays] = useState<Display[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('image');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsRes, displaysRes, contentRes, playlistsRes] =
        await Promise.all([
          apiClient.get('/api/v1/signage/groups'),
          apiClient.get('/api/v1/signage/displays'),
          apiClient.get('/api/v1/signage/content'),
          apiClient.get('/api/v1/signage/playlists'),
        ]);
      setGroups(groupsRes.data.items || []);
      setDisplays(displaysRes.data.items || []);
      setContent(contentRes.data.items || []);
      setPlaylists(playlistsRes.data.items || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load signage data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------------
  // Create handlers
  // -------------------------------------------------------------------

  const handleCreateDisplay = async () => {
    if (!createName.trim()) return;
    try {
      await apiClient.post('/api/v1/signage/displays', { name: createName });
      setCreateName('');
      setShowCreateForm(false);
      fetchData();
    } catch {
      setError('Failed to create display');
    }
  };

  const handleCreateContent = async () => {
    if (!createName.trim()) return;
    try {
      await apiClient.post('/api/v1/signage/content', {
        name: createName,
        content_type: createType,
      });
      setCreateName('');
      setShowCreateForm(false);
      fetchData();
    } catch {
      setError('Failed to create content');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!createName.trim()) return;
    try {
      await apiClient.post('/api/v1/signage/playlists', { name: createName });
      setCreateName('');
      setShowCreateForm(false);
      fetchData();
    } catch {
      setError('Failed to create playlist');
    }
  };

  const handleCreateGroup = async () => {
    if (!createName.trim()) return;
    try {
      await apiClient.post('/api/v1/signage/groups', { name: createName });
      setCreateName('');
      setShowCreateForm(false);
      fetchData();
    } catch {
      setError('Failed to create display group');
    }
  };

  const handleCreate = () => {
    if (activeTab === 'displays') handleCreateDisplay();
    else if (activeTab === 'content') handleCreateContent();
    else if (activeTab === 'playlists') handleCreatePlaylist();
    else handleCreateGroup();
  };

  const handlePublishContent = async (contentId: string) => {
    try {
      await apiClient.post(`/api/v1/signage/content/${contentId}/publish`);
      fetchData();
    } catch {
      setError('Failed to publish content');
    }
  };

  // -------------------------------------------------------------------
  // Status badge helpers
  // -------------------------------------------------------------------

  const displayStatusBadge = (status: string) => {
    const variant =
      status === 'online' ? 'success' : status === 'offline' ? 'secondary' : 'warning';
    return <Badge variant={variant}>{status}</Badge>;
  };

  const contentStatusBadge = (status: string) => {
    const variant =
      status === 'published'
        ? 'success'
        : status === 'draft'
          ? 'secondary'
          : 'warning';
    return <Badge variant={variant}>{status}</Badge>;
  };

  const contentTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Film className="h-4 w-4" />;
      case 'video':
        return <Play className="h-4 w-4" />;
      case 'menu_board':
        return <Layout className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  // -------------------------------------------------------------------
  // Tabs
  // -------------------------------------------------------------------

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'displays', label: 'Displays', icon: <Monitor className="h-4 w-4" /> },
    { key: 'content', label: 'Content', icon: <Film className="h-4 w-4" /> },
    { key: 'playlists', label: 'Playlists', icon: <Play className="h-4 w-4" /> },
    { key: 'groups', label: 'Groups', icon: <Layout className="h-4 w-4" /> },
  ];

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
        title="Digital Signage"
        description="Manage displays, content, and playlists"
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setShowCreateForm(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {activeTab === 'displays' && `${displays.length} display(s)`}
          {activeTab === 'content' && `${content.length} slide(s)`}
          {activeTab === 'playlists' && `${playlists.length} playlist(s)`}
          {activeTab === 'groups' && `${groups.length} group(s)`}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New {activeTab === 'displays' ? 'Display' : activeTab === 'content' ? 'Content' : activeTab === 'playlists' ? 'Playlist' : 'Group'}
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name
                </label>
                <Input
                  value={createName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateName(e.target.value)}
                  placeholder={`Enter ${activeTab.slice(0, -1)} name`}
                />
              </div>
              {activeTab === 'content' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-white"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="html">HTML</option>
                    <option value="menu_board">Menu Board</option>
                    <option value="promotion">Promotion</option>
                  </select>
                </div>
              )}
              <Button onClick={handleCreate}>Create</Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Displays tab */}
      {activeTab === 'displays' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displays.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {d.status === 'online' ? (
                      <Wifi className="h-4 w-4 text-green-400" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="font-medium text-white">{d.name}</span>
                  </div>
                  {displayStatusBadge(d.status)}
                </div>
                {d.pairing_code && (
                  <p className="text-sm text-gray-400">
                    Pairing Code:{' '}
                    <span className="font-mono text-yellow-400">
                      {d.pairing_code}
                    </span>
                  </p>
                )}
                {d.last_heartbeat_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last seen: {new Date(d.last_heartbeat_at).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {displays.length === 0 && (
            <p className="text-gray-500 col-span-full text-center py-8">
              No displays registered. Click &quot;New Display&quot; to add one.
            </p>
          )}
        </div>
      )}

      {/* Content tab */}
      {activeTab === 'content' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {content.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {contentTypeIcon(c.content_type)}
                    <span className="font-medium text-white">{c.name}</span>
                  </div>
                  {contentStatusBadge(c.status)}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span>{c.content_type}</span>
                  <span>{c.duration_seconds}s</span>
                </div>
                {c.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => handlePublishContent(c.id)}
                  >
                    Publish
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {content.length === 0 && (
            <p className="text-gray-500 col-span-full text-center py-8">
              No content slides yet. Click &quot;New Content&quot; to create one.
            </p>
          )}
        </div>
      )}

      {/* Playlists tab */}
      {activeTab === 'playlists' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Play className="h-4 w-4 text-blue-400" />
                  <span className="font-medium text-white">{p.name}</span>
                </div>
                <div className="flex gap-2 mt-1">
                  {p.shuffle && <Badge variant="info">Shuffle</Badge>}
                  {p.loop && <Badge variant="secondary">Loop</Badge>}
                  <Badge variant="default">Priority: {p.priority}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {playlists.length === 0 && (
            <p className="text-gray-500 col-span-full text-center py-8">
              No playlists yet. Click &quot;New Playlist&quot; to create one.
            </p>
          )}
        </div>
      )}

      {/* Groups tab */}
      {activeTab === 'groups' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardContent className="p-4">
                <span className="font-medium text-white">{g.name}</span>
                {g.description && (
                  <p className="text-sm text-gray-400 mt-1">
                    {g.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {groups.length === 0 && (
            <p className="text-gray-500 col-span-full text-center py-8">
              No display groups yet. Click &quot;New Group&quot; to create one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
